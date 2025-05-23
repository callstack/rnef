import fs from 'node:fs';
import path from 'node:path';
import { nativeFingerprint } from '../fingerprint/index.js';
import { getCacheRootPath } from '../project.js';

export const BUILD_CACHE_DIR = 'remote-build';

export type SupportedRemoteCacheProviders = 'github-actions';

export type RemoteArtifact = {
  name: string;
  url: string;
  id?: string; // optional, for example for GitHub Actions
};

export type LocalArtifact = {
  name: string;
};

export type CacheAvailabilityState =
  | {
      isAvailable: true;
      reason?: undefined;
    }
  | {
      isAvailable: false;
      reason: string;
    };

/**
 * Interface for implementing remote build cache providers.
 * Remote cache providers allow storing and retrieving native build artifacts (e.g. APK, IPA)
 * from remote storage like S3, GitHub Artifacts etc.
 */
export interface RemoteBuildCache {
  /** Unique identifier for this cache provider, will be displayed in logs */
  name: string;

  /**
   * Check if the remote cache provider is enabled
   * @returns True if the remote cache provider is enabled, false otherwise
   */
  getAvailabilityState(): Promise<CacheAvailabilityState>;

  /**
   * List available artifacts matching the given name pattern
   * @param artifactName - Passed after fingerprinting the build, e.g. `rnef-android-debug-1234567890` for android in debug variant
   * @param limit - Optional maximum number of artifacts to return
   * @returns Array of matching remote artifacts, or empty array if none found
   */
  list({
    artifactName,
    limit,
  }: {
    artifactName: string | undefined;
    limit?: number;
  }): Promise<RemoteArtifact[]>;

  /**
   * Download a remote artifact to local storage
   * @param artifactName - Name of the artifact to download, e.g. `rnef-android-debug-1234567890` for android in debug variant
   * @returns Response object from fetch, which will be used to download the artifact
   */
  download({ artifactName }: { artifactName: string }): Promise<Response>;

  /**
   * Delete a remote artifact
   * @param artifactName - Name of the artifact to delete, e.g. `rnef-android-debug-1234567890` for android in debug variant
   * @param limit - Optional maximum number of artifacts to delete
   * @param skipLatest - Optional flag to skip the latest artifact, helpful when deleting all but the latest artifact
   * @returns Array of deleted artifacts
   * @throws {Error} Throws if artifact is not found or deletion fails
   */
  delete({
    artifactName,
    limit,
    skipLatest,
  }: {
    artifactName: string;
    limit?: number;
    skipLatest?: boolean;
  }): Promise<RemoteArtifact[]>;

  /**
   * Upload a local artifact stored in build cache to remote storage
   * @param artifactName - Name of the artifact to upload, e.g. `rnef-android-debug-1234567890` for android in debug variant
   * @returns Remote artifact info if upload successful
   * @throws {Error} Throws if upload fails
   */
  upload({ artifactName }: { artifactName: string }): Promise<RemoteArtifact>;
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
  platform?: 'ios' | 'android';
  traits?: string[];
  root: string;
  fingerprintOptions: { extraSources: string[]; ignorePaths: string[] };
}): Promise<string> {
  if (!platform || !traits) {
    return '';
  }
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
  const files = fs.readdirSync(artifactPath);
  // Get the first non-hidden, non-directory file as the binary
  const binaryName = files.find((file) => file && !file.startsWith('.'));
  return binaryName ? path.join(artifactPath, binaryName) : null;
}
