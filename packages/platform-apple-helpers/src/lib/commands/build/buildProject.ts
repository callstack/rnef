import path from 'node:path';
import type { SubprocessError } from '@rnef/tools';
import { logger, RnefError, spawn, spinner } from '@rnef/tools';
import type { ApplePlatform, XcodeProjectInfo } from '../../types/index.js';
import { getBuildPaths } from '../../utils/buildPaths.js';
import { supportedPlatforms } from '../../utils/supportedPlatforms.js';
import type { RunFlags } from '../run/runOptions.js';
import type { BuildFlags } from './buildOptions.js';
import { simulatorDestinationMap } from './simulatorDestinationMap.js';

let lastProgress = 0;
/**
 * Creates an ASCII progress bar
 * @param percent - Percentage of completion (0-100)
 * @param length - Length of the progress bar in characters
 * @returns ASCII progress bar string
 */
function createProgressBar(percent: number, length = 20): string {
  const latestPercent = percent > lastProgress ? percent : lastProgress;
  lastProgress = latestPercent;
  const filledLength = Math.round(length * (latestPercent / 100));
  const emptyLength = length - filledLength;

  const filled = '█'.repeat(filledLength);
  const empty = '░'.repeat(emptyLength);

  return `[${filled}${empty}]`;
}

function reportProgress(
  chunk: string,
  loader: ReturnType<typeof spinner>,
  message: string
) {
  if (chunk.includes('PhaseScriptExecution')) {
    if (chunk.includes('[CP-User]\\ [Hermes]\\ Replace\\ Hermes\\')) {
      const progressBar = createProgressBar(10);
      loader.message(`${message} ${progressBar}`);
    }
    if (
      chunk.includes('[CP-User]\\ [RN]Check\\ rncore') &&
      chunk.includes('React-Fabric')
    ) {
      const progressBar = createProgressBar(35);
      loader.message(`${message} ${progressBar}`);
    }
    if (chunk.includes('[CP-User]\\ [RN]Check\\ FBReactNativeSpec')) {
      const progressBar = createProgressBar(53);
      loader.message(`${message} ${progressBar}`);
    }
    if (
      chunk.includes('[CP-User]\\ [RN]Check\\ rncore') &&
      chunk.includes('React-FabricComponents')
    ) {
      const progressBar = createProgressBar(66);
      loader.message(`${message} ${progressBar}`);
    }
    if (chunk.includes('[CP]\\ Check\\ Pods\\ Manifest.lock')) {
      const progressBar = createProgressBar(90);
      loader.message(`${message} ${progressBar}`);
    }
  } else if (chunk.includes('BUILD SUCCEEDED')) {
    const progressBar = createProgressBar(100);
    loader.message(`${message} ${progressBar}`);
  }
}

export const buildProject = async ({
  xcodeProject,
  sourceDir,
  platformName,
  udid,
  scheme,
  configuration,
  args,
}: {
  xcodeProject: XcodeProjectInfo;
  sourceDir: string;
  platformName: ApplePlatform;
  udid: string | undefined;
  scheme: string;
  configuration: string;
  args: RunFlags | BuildFlags;
}) => {
  const simulatorDest = simulatorDestinationMap[platformName];

  if (!simulatorDest) {
    throw new RnefError(
      `Unknown platform: ${platformName}. Please, use one of: ${Object.values(
        supportedPlatforms
      ).join(', ')}.`
    );
  }

  function determineDestinations(): string[] {
    if (args.destinations) {
      return args.destinations;
    }

    if (args.destination) {
      if (args.destination === 'simulator') {
        return [`generic/platform=${simulatorDest}`];
      }
      if (args.destination === 'device') {
        return [`generic/platform=${platformName}`];
      }
    }

    if (args.device) {
      // Check if the device argument looks like a UDID (assuming UDIDs are alphanumeric and have specific length)
      const isUDID = /^[A-Fa-f0-9-]{25,}$/.test(args.device);
      if (isUDID) {
        return [`id=${args.device}`];
      } else {
        // If it's a device name
        return [`name=${args.device}`];
      }
    }

    if (args.catalyst) {
      return ['platform=macOS,variant=Mac Catalyst'];
    }

    if (udid) {
      return [`id=${udid}`];
    }

    return [`generic/platform=${platformName}`];
  }

  const destinations = determineDestinations().flatMap((destination) => [
    '-destination',
    destination,
  ]);

  const xcodebuildArgs = [
    xcodeProject.isWorkspace ? '-workspace' : '-project',
    xcodeProject.name,
    ...(args.buildFolder ? ['-derivedDataPath', args.buildFolder] : []),
    '-configuration',
    configuration,
    '-scheme',
    scheme,
    ...destinations,
  ];

  if (args.archive) {
    const { archiveDir } = getBuildPaths(platformName);
    const archiveName = `${xcodeProject.name.replace(
      '.xcworkspace',
      ''
    )}.xcarchive`;

    xcodebuildArgs.push(
      '-archivePath',
      path.join(archiveDir, archiveName),
      'archive'
    );
  }

  if (args.extraParams) {
    xcodebuildArgs.push(...args.extraParams);
  }

  const loader = spinner({ indicator: 'timer' });
  const message = `${
    args.archive ? 'Archiving' : 'Building'
  } the app with xcodebuild for ${scheme} scheme in ${configuration} configuration`;

  loader.start(message);
  try {
    const process = spawn('xcodebuild', xcodebuildArgs, {
      cwd: sourceDir,
      stdio: logger.isVerbose() ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    });

    // Process the output from the AsyncIterable
    for await (const chunk of process) {
      reportProgress(chunk, loader, message);
    }

    await process;
    loader.stop(
      `${
        args.archive ? 'Archived' : 'Built'
      } the app with xcodebuild for ${scheme} scheme in ${configuration} configuration.`
    );
  } catch (error) {
    if ((error as SubprocessError).stderr.trim() === '') {
      loader.stop(
        'Running xcodebuild failed. Use --verbose flag to see the full output.'
      );
    } else {
      logger.error((error as SubprocessError).stderr);
      loader.stop('Running xcodebuild failed. See error details above.', 1);
    }

    if (!xcodeProject.isWorkspace) {
      throw new RnefError(
        `If your project uses CocoaPods, make sure to install pods with "pod install" in ${sourceDir} directory.`,
        { cause: error }
      );
    }

    throw new RnefError('Running xcodebuild failed', { cause: error });
  }
};
