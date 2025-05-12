import { color } from '../color.js';
import logger from '../logger.js';
import { spinner } from '../prompts.js';
import {
  getLocalBinaryPath,
  type RemoteBuildCache,
  type SupportedRemoteCacheProviders,
} from './common.js';
import type { LocalBuild } from './localBuildCache.js';
import { createRemoteBuildCache } from './remoteBuildCache.js';

export type Distribution = 'simulator' | 'device';

type FetchCachedBuildOptions = {
  artifactName: string;
  remoteCacheProvider:
    | SupportedRemoteCacheProviders
    | undefined
    | null
    | { new (): RemoteBuildCache };
};

export async function fetchCachedBuild({
  artifactName,
  remoteCacheProvider,
}: FetchCachedBuildOptions): Promise<LocalBuild | undefined> {
  if (remoteCacheProvider === null) {
    return undefined;
  }
  if (remoteCacheProvider === undefined) {
    logger.warn(`No remote cache provider set. You won't be able to access reusable builds from e.g. GitHub Actions. 
To configure it, set the "remoteCacheProvider" key in ${color.cyan(
      'rnef.config.mjs'
    )} file:
{
  remoteCacheProvider: 'github-actions'
}
To disable this warning, set "remoteCacheProvider" to null.
Proceeding with local build.`);
    return undefined;
  }

  const remoteBuildCache = await createRemoteBuildCache(remoteCacheProvider);
  if (!remoteBuildCache) {
    return undefined;
  }
  const loader = spinner();
  loader.start(`Looking for remote build cache on ${remoteBuildCache.name}.`);

  const remoteBuild = await remoteBuildCache.query({ artifactName });
  if (!remoteBuild) {
    loader.start('');
    loader.stop(`No remotely cached build found for "${artifactName}".`);
    return undefined;
  }

  loader.start(`Downloading cached build from ${remoteBuildCache.name}`);
  const fetchedBuild = await remoteBuildCache.download({
    artifact: remoteBuild,
    loader,
  });

  const binaryPath = getLocalBinaryPath(fetchedBuild.path);
  if (!binaryPath) {
    loader.stop(`No binary found for "${artifactName}".`);
    return undefined;
  }

  loader.stop(`Downloaded cached build: ${color.cyan(binaryPath)}.`);

  return {
    name: fetchedBuild.name,
    artifactPath: fetchedBuild.path,
    binaryPath,
  };
}
