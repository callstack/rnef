import fs from 'node:fs';
import path from 'node:path';
import type { FingerprintSources } from '@rnef/tools';
import {
  color,
  formatArtifactName,
  isInteractive,
  logger,
  promptSelect,
  RnefError,
  saveLocalBuildCache,
  spinner,
} from '@rnef/tools';
import type {
  BuilderCommand,
  ProjectConfig,
  XcodeProjectInfo,
} from '../../types/index.js';
import { buildApp } from '../../utils/buildApp.js';
import { getBuildPaths } from '../../utils/getBuildPaths.js';
import type { BuildFlags } from './buildOptions.js';
import { exportArchive } from './exportArchive.js';

export const createBuild = async ({
  platformName,
  projectConfig,
  args,
  projectRoot,
  reactNativePath,
  fingerprintOptions,
}: {
  platformName: BuilderCommand['platformName'];
  projectConfig: ProjectConfig;
  args: BuildFlags;
  projectRoot: string;
  reactNativePath: string;
  fingerprintOptions: FingerprintSources;
}) => {
  await validateArgs(args);

  let xcodeProject: XcodeProjectInfo;
  let sourceDir: string;
  const deviceOrSimulator = args.destination
    ? // there can be multiple destinations, so we'll pick the first one
      args.destination[0].match(/simulator/i)
      ? 'simulator'
      : 'device'
    : 'simulator';
  const artifactName = await formatArtifactName({
    platform: 'ios',
    traits: [deviceOrSimulator, args.configuration ?? 'Debug'],
    root: projectRoot,
    fingerprintOptions,
  });
  try {
    const { appPath, ...buildAppResult } = await buildApp({
      projectRoot,
      projectConfig,
      platformName,
      args,
      reactNativePath,
    });
    // The path may not exist when we archive
    if (fs.existsSync(appPath)) {
      const loader = spinner();
      loader.start('');
      loader.stop(`Build available at: ${color.cyan(appPath)}`);
    }
    xcodeProject = buildAppResult.xcodeProject;
    sourceDir = buildAppResult.sourceDir;
  } catch (error) {
    const message = `Failed to create ${args.archive ? 'archive' : 'build'}`;
    throw new RnefError(message, { cause: error });
  }

  if (args.archive) {
    const { archiveDir } = getBuildPaths(platformName);

    const archivePath = path.join(
      archiveDir,
      `${xcodeProject.name.replace('.xcworkspace', '')}.xcarchive`
    );

    const { ipaPath } = await exportArchive({
      sourceDir,
      archivePath,
      platformName,
      exportExtraParams: args.exportExtraParams ?? [],
      exportOptionsPlist: args.exportOptionsPlist,
    });

    // Save the IPA to the local build cache so it's available for remote-cache command
    saveLocalBuildCache(artifactName, ipaPath);
  }
};

async function validateArgs(args: BuildFlags) {
  if (!args.destination) {
    if (isInteractive()) {
      const destination = await promptSelect({
        message: 'Select destination for a generic build',
        options: [
          {
            label: 'Simulator',
            value: 'simulator',
          },
          {
            label: 'Device',
            value: 'device',
          },
        ],
      });

      args.destination = [destination];

      logger.info(
        `You can set configuration manually next time using "--destination ${destination}" flag.`
      );
    } else {
      logger.error(
        `The "--destination" flag is required in non-interactive environments. Available flag values:
- "simulator" – suitable for unsigned simulator builds for developers
- "device" – suitable for signed device builds for testers
- or values supported by "xcodebuild -destination" flag, e.g. "generic/platform=iOS"`
      );
      process.exit(1);
    }
  }
}
