import fs from 'node:fs';
import path from 'node:path';
import { nativeFingerprint } from '../fingerprint/index.js';
import { getCacheRootPath } from '../project.js';
import type { spinner } from '../prompts.js';

export const BUILD_CACHE_DIR = 'remote-build';

export type SupportedRemoteCacheProviders = 'github-actions';

export type RemoteArtifact = {
  name: string;
  downloadUrl: string;
};

export type LocalArtifact = {
  name: string;
  path: string;
};

export interface RemoteBuildCache {
  name: string;
  query({
    artifactName,
  }: {
    artifactName: string;
  }): Promise<RemoteArtifact | null>;
  download({
    artifact,
    loader,
  }: {
    artifact: RemoteArtifact;
    loader: ReturnType<typeof spinner>;
  }): Promise<LocalArtifact>;
}

/**
 * Used formats:
 * - rnef-android-debug-1234567890
 * - rnef-ios-simulator-debug-1234567890
 * - rnef-ios-device-debug-1234567890
 */
export async function formatArtifactName({
  platform,
  traits,
  root,
  fingerprintOptions,
}: {
  platform: 'ios' | 'android';
  traits: string[];
  root: string;
  fingerprintOptions: { extraSources: string[]; ignorePaths: string[] };
}): Promise<string> {
  const { hash } = await nativeFingerprint(root, {
    platform,
    ...fingerprintOptions,
  });
  return `rnef-${platform}-${traits.join('-')}-${hash}`;
}

export function getLocalArtifactPath(artifactName: string) {
  return path.join(getCacheRootPath(), BUILD_CACHE_DIR, artifactName);
}

export function getLocalBinaryPath(artifactPath: string) {
  let binaryPath: string | null = null;
  const files = fs.readdirSync(artifactPath);

  // assume there is only one binary in the artifact
  for (const file of files) {
    if (file) {
      binaryPath = path.join(artifactPath, file);
    }
    break;
  }

  return binaryPath;
}
