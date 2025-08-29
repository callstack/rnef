import fs from 'node:fs';
import path from 'node:path';
import type { FingerprintSources, RemoteBuildCache } from '@rock-js/tools';
import {
  colorLink,
  formatArtifactName,
  getBinaryPath,
  isInteractive,
  logger,
  promptSelect,
  relativeToCwd,
  RockError,
  saveLocalBuildCache,
} from '@rock-js/tools';
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
  brownfield,
  remoteCacheProvider,
}: {
  platformName: BuilderCommand['platformName'];
  projectConfig: ProjectConfig;
  args: BuildFlags;
  projectRoot: string;
  reactNativePath: string;
  fingerprintOptions: FingerprintSources;
  brownfield?: boolean;
  remoteCacheProvider: null | (() => RemoteBuildCache) | undefined;
}) => {
  await validateArgs(args);

  let xcodeProject: XcodeProjectInfo;
  let sourceDir: string;
  let scheme = args.scheme;
  const deviceOrSimulator = args.destination
    ? // there can be multiple destinations, so we'll pick the first one
      args.destination[0].match(/simulator/i)
      ? 'simulator'
      : 'device'
    : 'simulator';

  async function getArtifactName({ silent }: { silent?: boolean } = {}) {
    return await formatArtifactName({
      platform: 'ios',
      traits: [deviceOrSimulator, args.configuration ?? 'Debug'],
      root: projectRoot,
      fingerprintOptions,
      silent,
    });
  }

  let artifactName = await getArtifactName();

  const binaryPath = await getBinaryPath({
    artifactName,
    localFlag: args.local,
    remoteCacheProvider,
    fingerprintOptions,
    sourceDir: projectConfig.sourceDir,
  });

  if (binaryPath) {
    logger.log(`Build available at: ${colorLink(relativeToCwd(binaryPath))}`);

    if (args.archive) {
      const { exportDir } = getBuildPaths(platformName);
      if (fs.existsSync(exportDir) && fs.statSync(exportDir).isDirectory()) {
        logger.log(
          `Archives available at: ${colorLink(relativeToCwd(exportDir))}`,
        );
      }
    }

    return { scheme };
  }

  try {
    const { appPath, didInstallPods, ...buildAppResult } = await buildApp({
      projectRoot,
      projectConfig,
      platformName,
      args,
      reactNativePath,
      brownfield,
    });
    logger.log(`Build available at: ${colorLink(relativeToCwd(appPath))}`);

    xcodeProject = buildAppResult.xcodeProject;
    sourceDir = buildAppResult.sourceDir;
    scheme = buildAppResult.scheme;

    // After installing pods the fingerprint likely changes.
    // We update the artifact name to reflect the new fingerprint and store proper entry in the local cache.
    if (didInstallPods) {
      artifactName = await getArtifactName({ silent: true });
    }
    saveLocalBuildCache(artifactName, appPath);
  } catch (error) {
    const message = `Failed to create ${args.archive ? 'archive' : 'build'}`;
    throw new RockError(message, { cause: error });
  }

  if (args.archive) {
    const { archiveDir } = getBuildPaths(platformName);

    const archivePath = path.join(
      archiveDir,
      `${xcodeProject.name.replace('.xcworkspace', '')}.xcarchive`,
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

  return { scheme };
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
        `You can set configuration manually next time using "--destination ${destination}" flag.`,
      );
    } else {
      logger.error(
        `The "--destination" flag is required in non-interactive environments. Available flag values:
- "simulator" – suitable for unsigned simulator builds for developers
- "device" – suitable for signed device builds for testers
- or values supported by "xcodebuild -destination" flag, e.g. "generic/platform=iOS"`,
      );
      process.exit(1);
    }
  }
}
