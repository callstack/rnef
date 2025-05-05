import path from 'node:path';
import type { IOSProjectConfig } from '@react-native-community/cli-types';
import { RnefError, saveLocalBuildCache } from '@rnef/tools';
import type { BuildFlags } from '../commands/build/buildOptions.js';
import { buildProject } from '../commands/build/buildProject.js';
import { getBuildSettings } from '../commands/run/getBuildSettings.js';
import type { RunFlags } from '../commands/run/runOptions.js';
import type { ApplePlatform, ProjectConfig } from '../types/index.js';
import { getConfiguration } from './getConfiguration.js';
import { getInfo } from './getInfo.js';
import type { PlatformSDK } from './getPlatformInfo.js';
import { getScheme } from './getScheme.js';
import { getValidProjectConfig } from './getValidProjectConfig.js';
import { installPodsIfNeeded } from './pods.js';

export async function buildApp({
  args,
  projectConfig,
  pluginConfig,
  platformName,
  platformSDK,
  udid,
  projectRoot,
  deviceName,
  reactNativePath,
  artifactName,
  binaryPath,
}: {
  args: RunFlags | BuildFlags;
  projectConfig: ProjectConfig;
  pluginConfig?: IOSProjectConfig;
  platformName: ApplePlatform;
  platformSDK: PlatformSDK;
  udid?: string;
  deviceName?: string;
  projectRoot: string;
  reactNativePath: string;
  artifactName: string;
  binaryPath?: string;
}) {
  if (binaryPath) {
    return {
      appPath: binaryPath,
      // @todo Info.plist is hardcoded when reading from binaryPath
      infoPlistPath: path.join(binaryPath, 'Info.plist'),
      scheme: args.scheme,
      xcodeProject: projectConfig.xcodeProject,
      sourceDir: projectConfig.sourceDir,
    };
  }

  let { xcodeProject, sourceDir } = projectConfig;

  if (args.installPods) {
    await installPodsIfNeeded(
      projectRoot,
      platformName,
      sourceDir,
      args.newArch,
      reactNativePath
    );
    // When the project is not a workspace, we need to get the project config again,
    // because running pods install might have generated .xcworkspace project.
    // This should be only case in new project.
    if (xcodeProject.isWorkspace === false) {
      const newProjectConfig = getValidProjectConfig(
        platformName,
        projectRoot,
        pluginConfig
      );
      xcodeProject = newProjectConfig.xcodeProject;
      sourceDir = newProjectConfig.sourceDir;
    }
  }

  const info = await getInfo(xcodeProject, sourceDir);
  if (!info) {
    throw new RnefError('Failed to get Xcode project information');
  }
  const scheme = await getScheme(info.schemes, args.scheme, xcodeProject.name);
  const configuration = await getConfiguration(
    info.configurations,
    args.configuration
  );
  await buildProject({
    xcodeProject,
    sourceDir,
    platformName,
    udid,
    scheme,
    configuration,
    args,
    deviceName,
  });
  const buildSettings = await getBuildSettings(
    xcodeProject,
    sourceDir,
    configuration,
    platformSDK,
    scheme,
    args.target
  );
  const appPath = buildSettings.appPath;

  saveLocalBuildCache(artifactName, appPath);

  return {
    appPath,
    infoPlistPath: buildSettings.infoPlistPath,
    scheme: scheme,
    xcodeProject,
    sourceDir,
  };
}
