import path from 'node:path';
import { color, logger, RnefError, spawn } from '@rnef/tools';
import type { ApplePlatform, XcodeProjectInfo } from '../../types/index.js';

type BuildSettings = {
  TARGET_BUILD_DIR: string;
  INFOPLIST_PATH: string;
  EXECUTABLE_FOLDER_PATH: string;
  FULL_PRODUCT_NAME: string;
};

export async function getBuildSettings(
  xcodeProject: XcodeProjectInfo,
  sourceDir: string,
  platformName: ApplePlatform,
  configuration: string,
  destinations: string[],
  scheme: string,
  target?: string
): Promise<{ appPath: string; infoPlistPath: string }> {
  const { stdout: buildSettings } = await spawn(
    'xcodebuild',
    [
      xcodeProject.isWorkspace ? '-workspace' : '-project',
      xcodeProject.name,
      '-scheme',
      scheme,
      '-configuration',
      configuration,
      // -showBuildSettings fails when multiple destinations are passed
      '-destination',
      destinations[0],
      '-showBuildSettings',
      '-json',
    ],
    { cwd: sourceDir, stdio: 'pipe' }
  );

  const settings = JSON.parse(buildSettings);

  const targets = settings
    // skip React target if present; may happen in some older projects; @todo revisit
    .filter(({ target }: { target: string }) => target !== 'React')
    .map(({ target: settingsTarget }: { target: string }) => settingsTarget);

  let selectedTarget = targets[0];

  if (target) {
    if (!targets.includes(target)) {
      logger.info(
        `Target ${color.bold(target)} not found for scheme ${color.bold(
          scheme
        )}, automatically selected target ${color.bold(selectedTarget)}`
      );
    } else {
      selectedTarget = target;
    }
  }

  logger.debug(`Selected target: ${selectedTarget}`);

  // Find app in all building settings - look for WRAPPER_EXTENSION: 'app',
  const targetIndex = targets.indexOf(selectedTarget);
  const targetSettings = settings[targetIndex].buildSettings;

  const wrapperExtension = targetSettings.WRAPPER_EXTENSION;

  if (wrapperExtension === 'app' || wrapperExtension === 'framework') {
    const buildSettings = settings[targetIndex].buildSettings as BuildSettings;

    if (!buildSettings) {
      throw new RnefError('Failed to get build settings for your project');
    }

    const appPath = getBuildPath(buildSettings, platformName);
    const infoPlistPath = buildSettings.INFOPLIST_PATH;
    const targetBuildDir = buildSettings.TARGET_BUILD_DIR;

    return {
      appPath,
      infoPlistPath: path.join(targetBuildDir, infoPlistPath),
    };
  }

  throw new RnefError(
    `Failed to get build settings for your project. Looking for "app" or "framework" wrapper extension but found: ${wrapperExtension}`
  );
}

function getBuildPath(
  buildSettings: BuildSettings,
  platformName: ApplePlatform
) {
  const targetBuildDir = buildSettings.TARGET_BUILD_DIR;
  const executableFolderPath = buildSettings.EXECUTABLE_FOLDER_PATH;
  const fullProductName = buildSettings.FULL_PRODUCT_NAME;

  if (!targetBuildDir) {
    throw new Error('Failed to get the target build directory.');
  }

  if (!executableFolderPath) {
    throw new Error('Failed to get the app name.');
  }

  if (!fullProductName) {
    throw new Error('Failed to get product name.');
  }

  if (platformName === 'macos') {
    return path.join(targetBuildDir, fullProductName);
  } else {
    return path.join(targetBuildDir, executableFolderPath);
  }
}
