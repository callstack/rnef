import path from 'node:path';
import type { FingerprintSources } from '@rnef/tools';
import {
  color,
  formatArtifactName,
  isInteractive,
  logger,
  promptSelect,
  RnefError,
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
  try {
    const artifactName = await formatArtifactName({
      platform: 'ios',
      traits: [
        args.destination?.[0] ?? 'simulator',
        args.configuration ?? 'Debug',
      ],
      root: projectRoot,
      fingerprintOptions,
    });
    const { appPath, ...buildAppResult } = await buildApp({
      projectRoot,
      projectConfig,
      platformName,
      args,
      reactNativePath,
      artifactName,
    });
    const loader = spinner();
    loader.start('');
    loader.stop(`Build available at: ${color.cyan(appPath)}`);

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

    await exportArchive({
      sourceDir,
      archivePath,
      platformName,
      exportExtraParams: args.exportExtraParams ?? [],
      exportOptionsPlist: args.exportOptionsPlist,
    });
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
