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
  () =>
  (api: PluginApi): PluginOutput => {
    api.registerCommand({
      name: 'package:ios',
      description: 'Emit a .xcframework file from React Native code.',
      action: async (args: BuildFlags) => {
        intro('Packaging iOS project');

        const projectRoot = api.getProjectRoot();
        const iosConfig = getValidProjectConfig('ios', projectRoot, {});
        const { derivedDataDir } = getBuildPaths('ios');

        const destinations = args.destinations ?? [
          'generic/platform=iphoneos',
          'generic/platform=iphonesimulator',
        ];

        const buildFolder = args.buildFolder ?? derivedDataDir;
        const configuration = args.configuration ?? 'Debug';

        await createBuild(
          'ios',
          iosConfig,
          { ...args, destinations, buildFolder },
          projectRoot
        );

        if (!args.scheme) {
          throw new RnefError(
            'Scheme is required. Please provide "--scheme" flag.'
          );
        }

        try {
          await mergeFrameworks({
            scheme: args.scheme,
            configuration,
            sourceDir: iosConfig.sourceDir,
            platformName: 'ios',
            buildFolder,
          });
        } catch (error) {
          throw new RnefError('Failed to create package', { cause: error });
        }

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
