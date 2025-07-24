import fs from 'node:fs';
import path from 'node:path';
import type { PluginApi, PluginOutput } from '@rnef/config';
import type { FingerprintSources, RemoteBuildCache } from '@rnef/tools';
import {
  formatArtifactName,
  getLocalArtifactPath,
  getLocalBinaryPath,
  handleDownloadResponse,
  logger,
  RnefError,
} from '@rnef/tools';
import AdmZip from 'adm-zip';
import * as tar from 'tar';

type Flags = {
  platform?: 'ios' | 'android';
  traits?: string[];
  name?: string;
  json?: boolean;
  all?: boolean;
  allButLatest?: boolean;
  binaryPath?: string;
};

async function remoteCache({
  action,
  args,
  remoteCacheProvider,
  projectRoot,
  fingerprintOptions,
}: {
  action: string;
  args: Flags;
  remoteCacheProvider: null | (() => RemoteBuildCache);
  projectRoot: string;
  fingerprintOptions: FingerprintSources;
}) {
  const isJsonOutput = args.json;
  if (!remoteCacheProvider) {
    return null;
  }
  const remoteBuildCache = remoteCacheProvider();

  validateArgs(args, action);

  const artifactName =
    args.name ??
    (await formatArtifactName({
      platform: args.platform,
      traits: args.traits,
      root: projectRoot,
      fingerprintOptions,
      raw: isJsonOutput,
    }));

  switch (action) {
    case 'list': {
      const artifacts = await remoteBuildCache.list({
        artifactName,
        limit: args.all ? undefined : 1,
      });
      if (artifacts.length > 0 && !args.all) {
        const artifact = artifacts[0];
        if (isJsonOutput) {
          console.log(JSON.stringify(artifact, null, 2));
        } else {
          logger.log(`- name: ${artifact.name}
- url: ${artifact.url}`);
        }
      } else if (artifacts.length > 0 && args.all) {
        if (isJsonOutput) {
          console.log(JSON.stringify(artifacts, null, 2));
        } else {
          artifacts.forEach((artifact) => {
            logger.log(`- name: ${artifact.name}
- url: ${artifact.url}`);
          });
        }
      }
      break;
    }
    case 'list-all': {
      const artifactName = undefined;
      const artifacts = await remoteBuildCache.list({ artifactName });
      const platform = args.platform;
      const traits = args.traits;
      const output =
        platform && traits
          ? artifacts.filter((artifact) =>
              artifact.name.startsWith(`rnef-${platform}-${traits.join('-')}`)
            )
          : artifacts;
      if (isJsonOutput) {
        console.log(JSON.stringify(output, null, 2));
      } else {
        output.forEach((artifact) => {
          logger.log(`- name: ${artifact.name}
- url: ${artifact.url}`);
        });
      }
      break;
    }
    case 'download': {
      const localArtifactPath = getLocalArtifactPath(artifactName);
      const response = await remoteBuildCache.download({ artifactName });
      await handleDownloadResponse(response, localArtifactPath, artifactName);
      const binaryPath = getLocalBinaryPath(localArtifactPath);
      if (!binaryPath) {
        throw new RnefError(`Failed to save binary for "${artifactName}".`);
      }
      if (isJsonOutput) {
        console.log(
          JSON.stringify({ name: artifactName, path: binaryPath }, null, 2)
        );
      } else {
        logger.log(`- name: ${artifactName}
- path: ${binaryPath}`);
      }
      break;
    }
    case 'upload': {
      const localArtifactPath = getLocalArtifactPath(artifactName);
      const binaryPath =
        args.binaryPath ?? getLocalBinaryPath(localArtifactPath);
      if (!binaryPath) {
        throw new RnefError(`No binary found for "${artifactName}".`);
      }
      const zip = new AdmZip();
      const isBinaryPathDirectory = fs.statSync(binaryPath).isDirectory();
      const isAppDirectory = fs.statSync(binaryPath).isDirectory();
      const absoluteTarballPath =
        args.binaryPath ?? path.join(localArtifactPath, 'app.tar.gz');
      if (isBinaryPathDirectory) {
        // skip zipping, we're uploading a folder for ad-hoc builds
      } else if (isAppDirectory) {
        const appName = path.basename(binaryPath);
        if (!fs.existsSync(absoluteTarballPath)) {
          throw new RnefError(
            `No tarball found for "${artifactName}" in "${localArtifactPath}".`
          );
        }
        await tar.create(
          {
            file: absoluteTarballPath,
            cwd: path.dirname(binaryPath),
            gzip: true,
            filter: (filePath) => filePath.includes(appName),
          },
          [appName]
        );
        zip.addLocalFile(absoluteTarballPath);
      } else {
        zip.addLocalFile(binaryPath);
      }
      const buffer = zip.toBuffer();

      try {
        const uploadedArtifact =
          isBinaryPathDirectory && remoteBuildCache.uploadFolder
            ? await remoteBuildCache.uploadFolder({
                artifactName,
                folderPath: binaryPath,
                adHoc: true,
              })
            : await remoteBuildCache.upload({ artifactName, buffer });
        if (isJsonOutput) {
          console.log(JSON.stringify(uploadedArtifact, null, 2));
        } else {
          logger.log(`- name: ${uploadedArtifact.name}
- url: ${uploadedArtifact.url}`);
        }
      } finally {
        if (isAppDirectory && !isBinaryPathDirectory) {
          fs.unlinkSync(absoluteTarballPath);
        }
      }
      break;
    }
    case 'delete': {
      const deletedArtifacts = await remoteBuildCache.delete({
        artifactName,
        limit: args.all || args.allButLatest ? undefined : 1,
        skipLatest: args.allButLatest,
      });
      if (isJsonOutput) {
        console.log(JSON.stringify(deletedArtifacts, null, 2));
      } else {
        logger.log(
          deletedArtifacts
            .map(
              (artifact) => `- name: ${artifact.name}
- url: ${artifact.url}`
            )
            .join('\n')
        );
      }
      break;
    }
    case 'get-provider-name': {
      console.log(remoteBuildCache.name);
      break;
    }
  }

  return null;
}

function validateArgs(args: Flags, action: string) {
  if (!action) {
    // @todo make Commander handle this
    throw new RnefError(
      'Action is required. Available actions: list, list-all, download, upload, delete'
    );
  }
  if (action === 'list-all' || action === 'get-provider-name') {
    // return early as we don't need to validate name or platform
    // to list all artifacts or get provider name
    return;
  }
  if (args.name && (args.platform || args.traits)) {
    throw new RnefError(
      'Cannot use "--name" together with "--platform" or "--traits". Use either name or platform with traits'
    );
  }
  if (!args.name) {
    if ((args.platform && !args.traits) || (!args.platform && args.traits)) {
      throw new RnefError(
        'Either "--platform" and "--traits" must be provided together'
      );
    }
    if (!args.platform || !args.traits) {
      throw new RnefError(
        'Either "--name" or "--platform" and "--traits" must be provided'
      );
    }
  }
}

export const remoteCachePlugin =
  () =>
  (api: PluginApi): PluginOutput => {
    api.registerCommand({
      name: 'remote-cache',
      description: 'Manage remote cache',
      action: async (action: string, args: Flags) => {
        await remoteCache({
          action,
          args,
          remoteCacheProvider: (await api.getRemoteCacheProvider()) || null,
          projectRoot: api.getProjectRoot(),
          fingerprintOptions: api.getFingerprintOptions(),
        });
      },
      args: [
        {
          name: '[action]',
          description:
            'Select action, e.g. list, list-all, download, upload, delete, get-provider-name',
        },
      ],
      options: [
        {
          name: '--json',
          description: 'Output in JSON format',
        },
        {
          name: '--name <string>',
          description: 'Full artifact name',
        },
        {
          name: '--all',
          description:
            'List or delete all matching artifacts. Affects "list" and "delete" actions only',
        },
        {
          name: '--all-but-latest',
          description:
            'Delete all but the latest matching artifact. Affects "delete" action only',
        },
        {
          name: '-p, --platform <string>',
          description: 'Select platform, e.g. ios or android',
        },
        {
          name: '-t, --traits <list>',
          description: `Comma-separated traits that construct final artifact name. Traits for Android are: variant; for iOS: destination and configuration. 
Example iOS: --traits simulator,Release
Example Android: --traits debug`,
          parse: (val: string) => val.split(','),
        },
        {
          name: '--binary-path <string>',
          description: 'Path to the binary to upload',
        },
      ],
    });

    return {
      name: 'internal_remote-cache',
      description: 'Manage remote cache',
    };
  };
