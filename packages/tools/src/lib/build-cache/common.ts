import fs from 'node:fs';
import path from 'node:path';
import { color } from '../color.js';
import type { FingerprintSources } from '../fingerprint/index.js';
import { nativeFingerprint } from '../fingerprint/index.js';
import { isInteractive } from '../isInteractive.js';
import { getCacheRootPath } from '../project.js';
import { spinner } from '../prompts.js';

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

/**
 * Interface for implementing remote build cache providers.
 * Remote cache providers allow storing and retrieving native build artifacts (e.g. APK, IPA)
 * from remote storage like S3, GitHub Artifacts etc.
 */
export interface RemoteBuildCache {
  /** Unique identifier for this cache provider, will be displayed in logs */
  name: string;

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
   * @param buffer - Buffer of the artifact to upload
   * @returns Remote artifact info if upload successful
   * @throws {Error} Throws if upload fails
   */
  upload({
    artifactName,
    buffer,
  }: {
    artifactName: string;
    buffer: Buffer;
  }): Promise<RemoteArtifact>;

  /**
   * Upload a folder with multiple files to remote storage for ad-hoc builds
   * @param artifactName - Name of the artifact to upload, e.g. `rnef-android-debug-1234567890` for android in debug variant
   * @param folderPath - Path to the folder containing files to upload
   * @returns Remote artifact info if upload successful
   * @throws {Error} Throws if upload fails
   */
  uploadAdhocFolder?({
    artifactName,
    folderPath,
  }: {
    artifactName: string;
    folderPath: string;
  }): Promise<RemoteArtifact>;
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
  raw,
}: {
  platform?: 'ios' | 'android';
  traits?: string[];
  root: string;
  fingerprintOptions: FingerprintSources;
  raw?: boolean;
}): Promise<string> {
  if (!platform || !traits) {
    return '';
  }

  if (raw || !isInteractive()) {
    const { hash } = await nativeFingerprint(root, {
      ...fingerprintOptions,
      platform,
    });
    return `rnef-${platform}-${traits.join('-')}-${hash}`;
  }

  const loader = spinner();
  loader.start('Calculating project fingerprint');
  const { hash } = await nativeFingerprint(root, {
    ...fingerprintOptions,
    platform,
  });
  loader.stop(
    `Calculated project fingerprint: ${color.bold(color.magenta(hash))}`
  );
  return `rnef-${platform}-${traits.join('-')}-${hash}`;
}

export function getLocalArtifactPath(artifactName: string) {
  return path.join(getCacheRootPath(), BUILD_CACHE_DIR, artifactName);
}

export function getLocalBinaryPath(artifactPath: string) {
  const files = fs.readdirSync(artifactPath);
  // Get the first non-hidden file as the binary
  const binaryName = files.find((file) => file && !file.startsWith('.'));
  return binaryName ? path.join(artifactPath, binaryName) : null;
}
