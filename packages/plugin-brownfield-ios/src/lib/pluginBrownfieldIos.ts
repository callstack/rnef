import type { IOSProjectConfig } from '@react-native-community/cli-types';
import type { PluginApi, PluginOutput } from '@rnef/config';
import {
  type BuildFlags,
  createBuild,
  getBuildOptions,
  getBuildPaths,
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

        const destinations = args.destinations ?? [
          'generic/platform=iphoneos',
          'generic/platform=iphonesimulator',
        ];

        const buildFolder = args.buildFolder ?? derivedDataDir;
        const configuration = args.configuration ?? 'Debug';

        if (!args.scheme) {
          throw new RnefError(
            'Scheme is required. Please provide "--scheme" flag.'
          );
        }

        await createBuild({
          platformName: 'ios',
          projectConfig: iosConfig,
          args: { ...args, destinations, buildFolder },
          projectRoot,
          reactNativePath: api.getReactNativePath(),
        });

        await mergeFrameworks({
          scheme: args.scheme,
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
