import path from 'node:path';
import { color } from '../color.js';
import logger from '../logger.js';
import { getProjectRoot } from '../project.js';
import { spinner } from '../prompts.js';
import {
  getLocalBinaryPath,
  type RemoteBuildCache,
  type SupportedRemoteCacheProviders,
} from './common.js';
import type { LocalBuild } from './localBuildCache.js';
import { queryLocalBuildCache } from './localBuildCache.js';
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
}: FetchCachedBuildOptions): Promise<LocalBuild | null> {
  if (remoteCacheProvider === null) {
    return null;
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
    return null;
  }
  const loader = spinner();
  loader.start('Looking for a local cached build');

  const root = getProjectRoot();

  const localBuild = queryLocalBuildCache(artifactName);
  if (localBuild != null) {
    loader.stop(`Found local cached build: ${color.cyan(localBuild.name)}`);
    return localBuild;
  }

  const remoteBuildCache = await createRemoteBuildCache(remoteCacheProvider);
  if (!remoteBuildCache) {
    loader.stop(`No remote cache provider found, skipping.`);
    return null;
  }

  loader.stop(`No local build cached. Checking ${remoteBuildCache.name}.`);

  const artifacts = await remoteBuildCache.list({ artifactName, limit: 1 });
  if (!artifacts) {
    loader.start('');
    loader.stop(`No cached build found for "${artifactName}".`);
    return null;
  }

  loader.start(`Downloading cached build from ${remoteBuildCache.name}`);
  const fetchedBuild = await remoteBuildCache.download({
    artifact: artifacts[0],
    loader,
  });

  const binaryPath = getLocalBinaryPath(fetchedBuild.path);
  if (!binaryPath) {
    loader.stop(`No binary found for "${artifactName}".`);
    return null;
  }

  loader.stop(
    `Downloaded cached build: ${color.cyan(path.relative(root, binaryPath))}.`
  );

  return {
    name: fetchedBuild.name,
    artifactPath: fetchedBuild.path,
    binaryPath,
  };
}
