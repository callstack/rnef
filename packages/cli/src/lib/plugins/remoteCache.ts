import type { PluginApi, PluginOutput } from '@rnef/config';
import type {
  RemoteBuildCache,
  SupportedRemoteCacheProviders,
} from '@rnef/tools';
import {
  createRemoteBuildCache,
  formatArtifactName,
  getLocalBinaryPath,
  RnefError,
} from '@rnef/tools';

type Flags =
  | {
      source?: string;
      name: string;
    }
  | {
      platform: 'ios' | 'android';
      traits: string[];
      source?: string;
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
  remoteCacheProvider:
    | SupportedRemoteCacheProviders
    | null
    | { new (): RemoteBuildCache };
  projectRoot: string;
  fingerprintOptions: { extraSources: string[]; ignorePaths: string[] };
}) {
  const remoteBuildCache = await createRemoteBuildCache(remoteCacheProvider);
  if (!remoteBuildCache) {
    return null;
  }

  const artifactName =
    'name' in args
      ? args.name
      : await formatArtifactName({
          platform: args.platform,
          traits: args.traits,
          root: projectRoot,
          fingerprintOptions,
        });

  switch (action) {
    case 'list': {
      const artifacts = await remoteBuildCache.list({ artifactName });
      if (artifacts) {
        console.log(artifacts[0]);
      } else {
        throw new RnefError(`No artifacts found for "${artifactName}".`);
      }
      break;
    }
    case 'list-all': {
      const artifacts = await remoteBuildCache.list({
        artifactName: undefined,
      });
      if (artifacts) {
        console.log(artifacts);
      } else {
        throw new RnefError(`No artifacts found.`);
      }
      break;
    }
    case 'download': {
      const artifacts = await remoteBuildCache.list({ artifactName, limit: 1 });
      if (!artifacts) {
        throw new RnefError(`No artifacts found for "${artifactName}".`);
      }
      const fetchedBuild = await remoteBuildCache.download({
        artifact: artifacts[0],
      });
      const binaryPath = getLocalBinaryPath(fetchedBuild.path);
      if (!binaryPath) {
        throw new RnefError(`No binary found for "${artifactName}".`);
      }
      console.log(binaryPath);
      break;
    }
    case 'upload': {
      if (!args.source) {
        throw new RnefError(
          `Missing required "--source" parameter for upload action.`
        );
      }
      const uploadedArtifact = await remoteBuildCache.upload({
        artifactPath: args.source,
        artifactName,
      });
      console.log(uploadedArtifact);
      break;
    }
    case 'delete': {
      const success = await remoteBuildCache.delete({ artifactName });
      if (!success) {
        throw new RnefError(`Failed to delete artifact "${artifactName}".`);
      }
      break;
    }
  }

  return null;
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
          remoteCacheProvider: api.getRemoteCacheProvider() || null,
          projectRoot: api.getProjectRoot(),
          fingerprintOptions: api.getFingerprintOptions(),
        });
      },
      args: [
        {
          name: '<action>',
          description: 'Select action, e.g. query, download, upload, delete',
        },
      ],
      options: [
        {
          name: '--name <string>',
          description: 'Full artifact name',
        },
        {
          name: '-p, --platform <string>',
          description: 'Select platform, e.g. ios or android',
        },
        {
          name: '--traits <list>',
          description: `Comma-separated traits that construct final artifact name. Traits for Android are: variant; for iOS: destination and configuration. 
Example iOS: --traits simulator,Release
Example Android: --traits debug`,
          parse: (val: string) => val.split(','),
        },
        {
          name: '--source <path>',
          description:
            'Path to a single binary file to upload as an artifact (not a directory)',
        },
      ],
    });

    return {
      name: 'remote-cache',
      description: 'Manage remote cache',
    };
  };
