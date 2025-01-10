import { spinner } from '@clack/prompts';
import { RnefError } from '@rnef/tools';
import { existsSync, readdirSync } from 'fs';
import spawn from 'nano-spawn';
import path from 'path';
import { getBuildPaths } from '../../utils/buildPaths.js';

export const exportArchive = async ({
  sourceDir,
  archivePath,
  scheme,
  mode,
  platformName,
}: {
  sourceDir: string;
  archivePath: string;
  scheme: string;
  mode: string;
  platformName: string;
}) => {
  const loader = spinner();

  loader.start('Exporting the archive...');
  const exportOptionsPlistPath = path.join(sourceDir, 'ExportOptions.plist');

  if (!existsSync(exportOptionsPlistPath)) {
    loader.stop('Failed to export the archive.', 1);
    throw new RnefError(
      `ExportOptions.plist not found, please create ${path.relative(
        process.cwd(),
        exportOptionsPlistPath
      )} file with valid configuration for Archive export.`
    );
  }

  const { exportDir } = getBuildPaths(platformName);
  const xcodebuildArgs = [
    '-exportArchive',
    '-archivePath',
    archivePath,
    '-exportPath',
    exportDir,
    '-exportOptionsPlist',
    exportOptionsPlistPath,
  ];

  try {
    let ipaFiles: string[] = [];

    const { output } = await spawn('xcodebuild', xcodebuildArgs, {
      cwd: sourceDir,
    });
    try {
      ipaFiles = readdirSync(exportDir).filter((file) => file.endsWith('.ipa'));
    } catch {
      ipaFiles = [];
    }

    loader.stop(
      `Exported the archive for ${scheme} scheme in ${mode} mode to ${
        path.join(exportDir, ipaFiles[0]) ?? exportDir
      }`
    );
    return output;
  } catch (error) {
    loader.stop(
      'Running xcodebuild failed. Check the error message above for details.',
      1
    );
    throw new Error('Running xcodebuild failed', { cause: error });
  }
};
