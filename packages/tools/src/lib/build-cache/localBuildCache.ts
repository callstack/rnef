import fs from 'node:fs';
import path from 'node:path';
import { color } from '../color.js';
import logger from '../logger.js';
import { getLocalArtifactPath, getLocalBinaryPath } from './common.js';

export type LocalBuild = {
  name: string;
  artifactPath: string;
  binaryPath: string;
};

export function queryLocalBuildCache(artifactName: string): LocalBuild | null {
  const artifactPath = getLocalArtifactPath(artifactName);
  if (!fs.statSync(artifactPath, { throwIfNoEntry: false })?.isDirectory()) {
    return null;
  }
  const binaryPath = getLocalBinaryPath(artifactPath);
  if (binaryPath == null || !fs.existsSync(binaryPath)) {
    return null;
  }
  return {
    name: artifactName,
    artifactPath,
    binaryPath,
  };
}

export function saveLocalBuildCache(artifactName: string, binaryPath: string) {
  try {
    const cachePath = getLocalArtifactPath(artifactName);
    if (!fs.existsSync(cachePath)) {
      fs.mkdirSync(cachePath, { recursive: true });
    }
    if (fs.statSync(binaryPath).isDirectory()) {
      fs.cpSync(binaryPath, path.join(cachePath, path.basename(binaryPath)), {
        recursive: true,
      });
    } else {
      fs.copyFileSync(
        binaryPath,
        path.join(cachePath, path.basename(binaryPath))
      );
    }
    logger.log(
      `Saved build cache to: ${color.cyan(
        color.underline(color.bold(path.relative(process.cwd(), cachePath)))
      )}`
    );
  } catch (error) {
    logger.debug('Failed to copy binary to local build cache', error);
  }
}

export function getLocalBuildCacheBinaryPath(
  artifactName: string
): string | undefined {
  const localBuild = queryLocalBuildCache(artifactName);
  if (localBuild) {
    logger.log(
      `Found build cache for: ${color.bold(color.blue(localBuild.name))}`
    );
    return localBuild.binaryPath;
  }
  return undefined;
}
