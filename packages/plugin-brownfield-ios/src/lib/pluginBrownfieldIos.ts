import type { IOSProjectConfig } from '@react-native-community/cli-types';
import type { PluginApi, PluginOutput } from '@rnef/config';
import {
  type BuildFlags,
  createBuild,
  genericDestinations,
  getBuildOptions,
  getBuildPaths,
  getInfo,
  getScheme,
  getValidProjectConfig,
} from '@rnef/platform-apple-helpers';
import { intro, outro, RnefError } from '@rnef/tools';
import { mergeFrameworks } from './mergeFrameworks.js';
const buildOptions = getBuildOptions({ platformName: 'ios' });

export const pluginBrownfieldIos =
  (pluginConfig?: IOSProjectConfig) =>
  (api: PluginApi): PluginOutput => {
    api.registerCommand({
      name: 'package:ios',
      description: 'Emit a .xcframework file from React Native code.',
      action: async (args: BuildFlags) => {
        intro('Packaging iOS project');

        const projectRoot = api.getProjectRoot();
        const iosConfig = getValidProjectConfig(
          'ios',
          projectRoot,
          pluginConfig
        );
        const { derivedDataDir } = getBuildPaths('ios');

        const destination = args.destination ?? [
          genericDestinations.ios.device,
          genericDestinations.ios.simulator,
        ];

        const buildFolder = args.buildFolder ?? derivedDataDir;
        const configuration = args.configuration ?? 'Debug';

        const { xcodeProject, sourceDir } = iosConfig;
        const info = await getInfo(xcodeProject, sourceDir);
        if (!info) {
          throw new RnefError('Failed to get Xcode project information');
        }

        const scheme = await getScheme(
          info.schemes,
          args.scheme,
          xcodeProject.name
        );
        await createBuild({
          platformName: 'ios',
          projectConfig: iosConfig,
          args: { ...args, scheme, destination, buildFolder },
          projectRoot,
          reactNativePath: api.getReactNativePath(),
          fingerprintOptions: api.getFingerprintOptions(),
        });

        await mergeFrameworks({
          scheme,
          configuration,
          sourceDir: iosConfig.sourceDir,
          platformName: 'ios',
          buildFolder,
        });

        outro('Success 🎉.');
      },
      options: buildOptions,
    });

    return {
      name: 'plugin-brownfield-ios',
      description: 'RNEF plugin for brownfield iOS.',
    };
  };

export default pluginBrownfieldIos;
