import fs, { existsSync } from 'node:fs';
import path from 'node:path';
import type { SubprocessError } from '@rnef/tools';
import { color, logger, spawn, spinner } from '@rnef/tools';

/**
 * Xcode emits different `.framework` file based on the destination (simulator arm64/x86_64, iphone arm64 etc.)
 * This takes those `.frameworks` files and merges them to a single `.xcframework` file for easier distribution.
 */
export async function mergeFrameworks({
  frameworkPaths,
  outputPath,
  sourceDir
}: {
  frameworkPaths: string[],
  outputPath: string
  sourceDir: string
}) {
  const loader = spinner();
  const xcframeworkName = path.basename(outputPath)

  if (existsSync(outputPath)) {
    logger.debug(`Removing `)
    await fs.promises.rm(outputPath, { recursive: true, force: true });
  }

  loader.start(`Creating ${color.bold(xcframeworkName)}`);

  const xcodebuildArgs = [
    '-create-xcframework',
    ...frameworkPaths.flatMap(frameworkPath => [
      '-framework',
      frameworkPath
    ]),
    '-output',
    outputPath
  ];

  try {
    await spawn('xcodebuild', xcodebuildArgs, { cwd: sourceDir });

    loader.stop(
      `Created ${color.bold(xcframeworkName)}`
    );
  } catch (error) {
    loader.stop(
      `Couldn't create ${color.bold(xcframeworkName)}.  Check the error message above for details.`,
      1
    );
    throw new Error('Running xcodebuild failed', {
      cause: (error as SubprocessError).stderr,
    });
  }
}
