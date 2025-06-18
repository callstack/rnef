import * as clientS3 from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { RemoteArtifact, RemoteBuildCache } from '@rnef/tools';
import type { Readable } from 'stream';

function toWebStream(stream: Readable): ReadableStream {
  return new ReadableStream({
    start(controller) {
      stream.on('data', (chunk) => controller.enqueue(chunk));
      stream.on('end', () => controller.close());
      stream.on('error', (err) => controller.error(err));
    },
  });
}

type ProviderConfig = {
  /**
   * Optional endpoint, necessary for self-hosted S3 servers or Cloudflare R2 integration.
   */
  endpoint?: string;
  /**
   * The bucket name to use for the S3 server.
   */
  bucket: string;
  /**
   * The region of the S3 server.
   */
  region: string;
  /**
   * The access key ID for the S3 server.
   */
  accessKeyId: string;
  /**
   * The secret access key for the S3 server.
   */
  secretAccessKey: string;
  /**
   * The directory to store artifacts in the S3 server.
   */
  directory?: string;
  /**
   * The display name of the provider
   */
  name?: string;
  /**
   * The time in seconds for the presigned URL to expire. By default, it is 24 hours.
   */
  linkExpirationTime?: number;
};

export class S3BuildCache implements RemoteBuildCache {
  name = 'S3';
  directory = 'rnef-artifacts';
  s3: clientS3.S3Client;
  bucket: string;
  config: ProviderConfig;
  linkExpirationTime: number;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.s3 = new clientS3.S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    const awsBucket = config.bucket ?? '';
    const bucketTokens = awsBucket.split('/');
    this.bucket = bucketTokens.shift() as string;
    this.directory = config.directory ?? this.directory;
    this.name = config.name ?? this.name;
    this.linkExpirationTime = config.linkExpirationTime ?? 3600 * 24;
  }

  async list({
    artifactName,
  }: {
    artifactName?: string;
  }): Promise<RemoteArtifact[]> {
    const artifacts = await this.s3.send(
      new clientS3.ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: artifactName
          ? `${this.directory}/${artifactName}.zip`
          : `${this.directory}/`,
      })
    );

    const results: RemoteArtifact[] = [];

    for (const artifact of artifacts.Contents ?? []) {
      if (!artifact.Key) continue;

      const name = artifactName ?? artifact.Key.split('/').pop() ?? '';

      // Generate presigned URL for each artifact
      const presignedUrl = await getSignedUrl(
        this.s3,
        new clientS3.GetObjectCommand({
          Bucket: this.bucket,
          Key: artifact.Key,
        }),
        { expiresIn: this.linkExpirationTime }
      );

      results.push({ name, url: presignedUrl });
    }

    return results;
  }

  async download({
    artifactName,
  }: {
    artifactName: string;
  }): Promise<Response> {
    const res = await this.s3.send(
      new clientS3.GetObjectCommand({
        Bucket: this.bucket,
        Key: `${this.directory}/${artifactName}.zip`,
      })
    );
    return new Response(toWebStream(res.Body as Readable), {
      headers: {
        'content-length': String(res.ContentLength),
      },
    });
  }

  async delete({
    artifactName,
    skipLatest,
  }: {
    artifactName: string;
    skipLatest?: boolean;
  }): Promise<RemoteArtifact[]> {
    if (skipLatest) {
      // Artifacts on S3 are unique by name, so skipping latest means we don't delete anything
      return [];
    }
    await this.s3.send(
      new clientS3.DeleteObjectCommand({
        Bucket: this.bucket,
        Key: `${this.directory}/${artifactName}.zip`,
      })
    );
    return [
      {
        name: artifactName,
        url: `${this.bucket}/${this.directory}/${artifactName}.zip`,
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
    const key = `${this.directory}/${artifactName}.zip`;

    await this.s3.send(
      new clientS3.PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentLength: buffer.length,
        Metadata: {
          createdAt: new Date().toISOString(),
        },
      })
    );

    // Generate a presigned URL for the uploaded object
    const presignedUrl = await getSignedUrl(
      this.s3,
      new clientS3.GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: this.linkExpirationTime }
    );

    return { name: artifactName, url: presignedUrl };
  }
}

export const providerS3 = (options: ProviderConfig) => (): RemoteBuildCache =>
  new S3BuildCache(options);
