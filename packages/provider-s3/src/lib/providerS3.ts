import * as clientS3 from '@aws-sdk/client-s3';
import type { RemoteArtifact, RemoteBuildCache } from '@rnef/tools';
import type { Readable } from 'stream';

async function readableStreamToBuffer(
  readableStream: Readable
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    readableStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    readableStream.on('end', () => resolve(Buffer.concat(chunks)));
    readableStream.on('error', reject);
  });
}

export class S3BuildCache implements RemoteBuildCache {
  name = 'S3';
  s3: clientS3.S3Client;
  bucket: string;
  config: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  } | null = null;

  constructor(config: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  }) {
    this.config = config;
    this.s3 = new clientS3.S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    const awsBucket = config.bucket ?? '';
    const bucketTokens = awsBucket.split('/');
    this.bucket = bucketTokens.shift() as string;
  }

  async list({
    artifactName,
  }: {
    artifactName?: string;
  }): Promise<RemoteArtifact[]> {
    const artifacts = await this.s3.send(
      new clientS3.ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: artifactName ? `builds/${artifactName}.zip` : 'builds/',
      })
    );
    return (
      artifacts.Contents?.map((artifact) => ({
        name: artifactName ?? artifact.Key?.split('/').pop() ?? '',
        url: `s3://${this.bucket}/${artifact.Key}`,
      })) ?? []
    );
  }

  async download({
    artifactName,
  }: {
    artifactName: string;
  }): Promise<Response> {
    const res = await this.s3.send(
      new clientS3.GetObjectCommand({
        Bucket: this.bucket,
        Key: `builds/${artifactName}.zip`,
      })
    );
    const buffer = await readableStreamToBuffer(res.Body as Readable);
    return new Response(buffer);
  }

  async delete({
    artifactName,
  }: {
    artifactName: string;
  }): Promise<RemoteArtifact[]> {
    await this.s3.send(
      new clientS3.DeleteObjectCommand({
        Bucket: this.bucket,
        Key: `builds/${artifactName}.zip`,
      })
    );
    return [
      {
        name: artifactName,
        url: `s3://${this.bucket}/builds/${artifactName}.zip`,
      },
    ];
  }

  async upload({
    artifactName,
    buffer,
  }: {
    artifactName: string;
    buffer: Buffer;
  }): Promise<RemoteArtifact> {
    await this.s3.send(
      new clientS3.PutObjectCommand({
        Bucket: this.bucket,
        Key: `builds/${artifactName}.zip`,
        Body: buffer,
        ContentLength: buffer.length,
        Metadata: {
          createdAt: new Date().toISOString(),
        },
      })
    );
    return {
      name: artifactName,
      url: `s3://${this.bucket}/builds/${artifactName}.zip`,
    };
  }
}

export const providerS3 =
  (options?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  }) =>
  (): RemoteBuildCache =>
    // @ts-expect-error tbd
    new S3BuildCache(options);
