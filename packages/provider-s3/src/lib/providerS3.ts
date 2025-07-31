import fs from 'node:fs';
import path from 'node:path';
import * as clientS3 from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';
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
   * The access key ID for the S3 server. Not required when using IAM roles or other auth methods.
   */
  accessKeyId?: string;
  /**
   * The secret access key for the S3 server. Not required when using IAM roles or other auth methods.
   */
  secretAccessKey?: string;
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
  /**
   * AWS profile name to use for authentication. Useful for local development.
   */
  profile?: string;
  /**
   * Role ARN to assume for authentication. Useful for cross-account access.
   */
  roleArn?: string;
  /**
   * Session name when assuming a role.
   */
  roleSessionName?: string;
  /**
   * External ID when assuming a role (for additional security).
   */
  externalId?: string;
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

    const s3Config: clientS3.S3ClientConfig = {
      endpoint: config.endpoint,
      region: config.region,
    };

    if (config.accessKeyId && config.secretAccessKey) {
      s3Config.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    } else if (config.roleArn) {
      // Use STS to assume a role
      s3Config.credentials = fromTemporaryCredentials({
        params: {
          RoleArn: config.roleArn,
          RoleSessionName: config.roleSessionName ?? 's3-build-cache-session',
          ExternalId: config.externalId,
        },
        // Optional: use named profile as source credentials
        masterCredentials: config.profile
          ? fromIni({ profile: config.profile })
          : undefined,
      });
    } else if (config.profile) {
      // Use shared config file (e.g. ~/.aws/credentials) with a profile
      s3Config.credentials = fromIni({ profile: config.profile });
    }

    this.s3 = new clientS3.S3Client(s3Config);

    const awsBucket = config.bucket ?? '';
    const bucketTokens = awsBucket.split('/');
    this.bucket = bucketTokens.shift() as string;
    this.directory = config.directory ?? this.directory;
    this.name = config.name ?? this.name;
    this.linkExpirationTime = config.linkExpirationTime ?? 3600 * 24;
  }

  private async uploadFile(
    key: string,
    buffer: Buffer,
    contentType?: string
  ): Promise<void> {
    await this.s3.send(
      new clientS3.PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentLength: buffer.length,
        ContentType: contentType,
        Metadata: {
          createdAt: new Date().toISOString(),
        },
      })
    );
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
      // @todo revisit with bucket versioning
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

    await this.uploadFile(key, buffer);

    const presignedUrl = await getSignedUrl(
      this.s3,
      new clientS3.GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: this.linkExpirationTime }
    );

    return { name: artifactName, url: presignedUrl };
  }

  async uploadAdhocFolder({
    artifactName,
    folderPath,
  }: {
    artifactName: string;
    folderPath: string;
  }): Promise<RemoteArtifact> {
    const uploadPromises: Promise<void>[] = [];

    // Return a reference to the folder (using the first file as the main URL)
    const firstFileKey = `${this.directory}/ad-hoc/${artifactName}`;
    const presignedUrl = await getSignedUrl(
      this.s3,
      new clientS3.GetObjectCommand({ Bucket: this.bucket, Key: firstFileKey }),
      { expiresIn: this.linkExpirationTime }
    );

    const uploadFileToFolder = async (
      filePath: string,
      relativePath: string
    ) => {
      const fileBuffer = fs.readFileSync(filePath);
      const key = `${this.directory}/ad-hoc/${artifactName}/${relativePath}`;
      const isHTML = filePath.endsWith('.html');

      await this.uploadFile(key, fileBuffer, isHTML ? 'text/html' : undefined);
    };

    const processDirectory = (dirPath: string, relativePath: string = '') => {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const fullPath = path.join(dirPath, item);

        if (fullPath.endsWith('.html')) {
          fs.writeFileSync(
            fullPath,
            fs
              .readFileSync(fullPath, 'utf-8')
              .replace('{{BASE_URL}}', presignedUrl.split('?')[0])
          );
        }
        if (fullPath.endsWith('.plist')) {
          fs.writeFileSync(
            fullPath,
            fs
              .readFileSync(fullPath, 'utf-8')
              .replace('{{BASE_URL}}', presignedUrl.split('?')[0])
          );
        }

        const itemRelativePath = relativePath
          ? path.join(relativePath, item)
          : item;

        if (fs.statSync(fullPath).isDirectory()) {
          processDirectory(fullPath, itemRelativePath);
        } else {
          uploadPromises.push(uploadFileToFolder(fullPath, itemRelativePath));
        }
      }
    };

    processDirectory(folderPath);
    await Promise.all(uploadPromises);

    return { name: artifactName, url: presignedUrl };
  }
}

export const providerS3 = (options: ProviderConfig) => (): RemoteBuildCache =>
  new S3BuildCache(options);
