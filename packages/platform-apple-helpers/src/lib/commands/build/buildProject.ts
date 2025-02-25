import path from 'node:path';
import type { SubprocessError } from '@rnef/tools';
import { logger, RnefError, spawn, spinner } from '@rnef/tools';
import type { ApplePlatform, XcodeProjectInfo } from '../../types/index.js';
import { getBuildPaths } from '../../utils/buildPaths.js';
import { supportedPlatforms } from '../../utils/supportedPlatforms.js';
import type { BuildFlags } from './buildOptions.js';
import { simulatorDestinationMap } from './simulatorDestinationMap.js';

export const buildProject = async (
  xcodeProject: XcodeProjectInfo,
  sourceDir: string,
  platformName: ApplePlatform,
  udid: string | undefined,
  scheme: string,
  configuration: string,
  args: BuildFlags
) => {
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
    const { output } = await spawn('xcodebuild', xcodebuildArgs, {
      cwd: sourceDir,
      stdio: logger.isVerbose() ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    });
    loader.stop(
      `${
        args.archive ? 'Archived' : 'Built'
      } the app with xcodebuild for ${scheme} scheme in ${configuration} configuration.`
    );
    return output;
  } catch (error) {
    logger.error((error as SubprocessError).stderr);
    loader.stop(
      'Running xcodebuild failed. Check the error message above for details.',
      1
    );

    if (!xcodeProject.isWorkspace) {
      throw new RnefError(
        `If your project uses CocoaPods, make sure to install pods with "pod install" in ${sourceDir} directory.`,
        { cause: error }
      );
    }

    throw new RnefError('Running xcodebuild failed', { cause: error });
  }
};
