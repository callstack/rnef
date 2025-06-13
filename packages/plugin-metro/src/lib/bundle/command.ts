import fs from 'node:fs';
import path from 'node:path';
import {
  bundleCommand,
  // @ts-expect-error missing typings - TODO drop dependency on community plugin
} from '@react-native/community-cli-plugin';
import type { PluginApi } from '@rnef/config';
import { color, intro, logger, outro, RnefError, runHermes, spinner } from '@rnef/tools';

type BundleCommandArgs = {
  assetsDest?: string;
  assetCatalogDest?: string;
  entryFile: string;
  resetCache: boolean;
  resetGlobalCache: boolean;
  transformer?: string;
  minify?: boolean;
  config?: string;
  platform: string;
  dev: boolean;
  bundleOutput: string;
  bundleEncoding?: 'utf8' | 'utf16le' | 'ascii';
  maxWorkers?: string;
  sourcemapOutput?: string;
  sourcemapSourcesRoot?: string;
  sourcemapUseAbsolutePath: boolean;
  verbose: boolean;
  unstableTransformProfile: string;
  indexedRamBundle?: boolean;
  resolverOption?: Array<string>;
  // custom flags
  hermes: boolean;
};

export function registerBundleCommand(api: PluginApi) {
  api.registerCommand({
    name: 'bundle',
    description:
      'Build the bundle for the provided JavaScript entry file with Metro.',
    action: async (args: BundleCommandArgs) => {
      if (!args.platform || !args.bundleOutput || !args.entryFile) {
        throw new RnefError(
          '"rnef bundle" command requires all of these flags to bundle JavaScript with Metro: \n  "--platform", "--bundle-output", "--entry-file"'
        );
      }
      intro('Compiling JS bundle with Metro');
      const root = api.getProjectRoot();
      const reactNativeVersion = api.getReactNativeVersion();
      const reactNativePath = api.getReactNativePath();
      const platforms = api.getPlatforms();

      // create the bundle output directory if it doesn't exist
      const bundleOutputDir = path.dirname(args.bundleOutput);
      fs.mkdirSync(bundleOutputDir, { recursive: true });

      await bundleCommand.func(
        undefined,
        { root, reactNativeVersion, reactNativePath, platforms },
        args
      );

      if (args.hermes) {
        const loader = spinner();
        loader.start('Running Hermes compiler...');
        await runHermes({
          bundleOutputPath: args.bundleOutput,
          sourcemapOutputPath: args.sourcemapOutput,
        });
        loader.stop(
          `Hermes bytecode bundle created at: ${color.cyan(args.bundleOutput)}`
        );
      } else {
        logger.info(
          `JavaScript bundle created at: ${color.cyan(args.bundleOutput)}`
        );
      }
      outro('Success 🎉.');
    },
    options: [
      ...bundleCommand.options,
      {
        name: '--config-cmd [string]',
        description:
          '[Internal] A hack for Xcode build script pointing to wrong bundle command that recognizes this flag. Do not use.',
      },
      {
        name: '--hermes',
        description:
          'Passes the output JS bundle to Hermes compiler and outputs a bytecode file.',
      },
    ],
  });
}
