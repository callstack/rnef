import path from 'node:path';
import type { IOSProjectConfig } from '@react-native-community/cli-types';
import type { PluginApi, PluginOutput } from '@rnef/config';
import {
  type BuildFlags,
  createBuild,
  genericDestinations,
  getBuildOptions,
  getBuildPaths,
  getValidProjectConfig,
} from '@rnef/platform-apple-helpers';
import { color, intro, outro, spinner } from '@rnef/tools';
import { copyHermesXcframework } from './copyHermesXcframework.js';
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

        // 1) Build the project
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

        const { sourceDir } = iosConfig;

        const { scheme } = await createBuild({
          platformName: 'ios',
          projectConfig: iosConfig,
          args: { ...args, destination, buildFolder },
          projectRoot,
          reactNativePath: api.getReactNativePath(),
          fingerprintOptions: api.getFingerprintOptions(),
          brownfield: true,
        });

        // 2) Merge the .framework outputs of the framework target
        const productsPath = path.join(buildFolder, 'Build', 'Products');
        const { packageDir: frameworkTargetOutputDir } = getBuildPaths('ios');

        await mergeFrameworks({
          sourceDir,
          frameworkPaths: [
            path.join(
              productsPath,
              `${configuration}-iphoneos`,
              `${scheme}.framework`
            ),
            path.join(
              productsPath,
              `${configuration}-iphonesimulator`,
              `${scheme}.framework`
            ),
          ],
          outputPath: path.join(
            frameworkTargetOutputDir,
            `${scheme}.xcframework`
          ),
        });

        // 3) Merge React Native Brownfield paths
        await mergeFrameworks({
          sourceDir,
          frameworkPaths: [
            path.join(
              productsPath,
              `${configuration}-iphoneos`,
              'ReactBrownfield',
              'ReactBrownfield.framework'
            ),
            path.join(
              productsPath,
              `${configuration}-iphonesimulator`,
              'ReactBrownfield',
              'ReactBrownfield.framework'
            ),
          ],
          outputPath: path.join(
            frameworkTargetOutputDir,
            'ReactBrownfield.xcframework'
          ),
        });

        // 4) Copy hermes xcframework to the output path
        copyHermesXcframework({
          sourceDir,
          destinationDir: frameworkTargetOutputDir,
        });

        // 5) Inform the user
        const loader = spinner();
        loader.start('');
        loader.stop(
          `XCFrameworks are available at: ${color.cyan(
            path.relative(process.cwd(), frameworkTargetOutputDir)
          )}`
        );

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
