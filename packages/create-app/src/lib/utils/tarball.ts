import fs from 'node:fs';
import path from 'node:path';
import { RnefError } from '@rnef/tools';
import packageJson from 'package-json';
import * as tar from 'tar';
import { getNameWithoutExtension } from './fs.js';

export async function downloadTarballFromNpm(
  packageName: string,
  version = 'latest',
  targetDir: string
) {
  try {
    const metadata = await packageJson(packageName, { version });

    const tarballUrl = metadata['dist']?.tarball;
    if (!tarballUrl) {
      throw new RnefError('Tarball URL not found.');
    }

    const response = await fetch(tarballUrl);
    if (!response.ok) {
      throw new RnefError(
        `Failed to fetch package ${packageName}: ${response.statusText}`
      );
    }

    const tarballPath = path.join(
      targetDir,
      `${packageName.replace('/', '-')}.tgz`
    );
    // Write the tarball to disk
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(tarballPath, new Uint8Array(arrayBuffer));

    return tarballPath;
  } catch (error) {
    throw new RnefError(`Error downloading package ${packageName}`, {
      cause: error,
    });
  }
}

/**
 * Extracts a tarball to a temporary directory and returns the path to the extracted directory
 * @param tarballPath - Path to the tarball to extract
 * @param targetDir - Parent directory where temp directory will be created in
 * @returns Path to the extracted directory
 */
// This automatically handles both .tgz and .tar files
export async function extractTarballToTempDirectory(
  targetDir: string,
  tarballPath: string
): Promise<string> {
  const tempFolder = path.join(
    targetDir,
    `.temp-${getNameWithoutExtension(tarballPath)}-${Date.now()}`
  );
  fs.mkdirSync(tempFolder, { recursive: true });

  await tar.extract({
    file: tarballPath,
    cwd: tempFolder,
    strip: 1, // Remove top-level directory
  });

  return tempFolder;
}
