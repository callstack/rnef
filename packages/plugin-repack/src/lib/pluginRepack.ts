import commands from '@callstack/repack/commands/rspack';
import type { PluginApi, PluginOutput } from '@rnef/config';
import {
  color,
  findDevServerPort,
  intro,
  logger,
  RnefError,
  runHermes,
  spinner,
} from '@rnef/tools';

type PluginConfig = {
  platforms?: {
    [key: string]: object;
  };
};

type StartArgs = Parameters<NonNullable<typeof startCommand>['func']>[2];
type BundleArgs = Parameters<NonNullable<typeof bundleCommand>['func']>[2] & {
  // custom flags
  hermes: boolean;
};

const startCommand = commands.find((command) => command.name === 'start');
const bundleCommand = commands.find((command) => command.name === 'bundle');

export const pluginRepack =
  (pluginConfig: PluginConfig = {}) =>
  (api: PluginApi): PluginOutput => {
    if (!startCommand) {
      throw new RnefError('Re.Pack "start" command not found.');
    }

    if (!bundleCommand) {
      throw new RnefError('Re.Pack "bundle" command not found.');
    }

    api.registerCommand({
      name: 'start',
      description: 'Starts Re.Pack dev server.',
      action: async (args: StartArgs) => {
        const root = api.getProjectRoot();
        const platforms = api.getPlatforms();
        const { port, startDevServer } = await findDevServerPort(
          args.port ? Number(args.port) : 8081,
          root
        );

        if (!startDevServer) {
          return;
        }

        startCommand.func(
          [],
          // @ts-expect-error TODO fix getPlatforms type
          { root, platforms, ...pluginConfig },
          { ...args, port }
        );
      },
      // @ts-expect-error fixup types
      options: startCommand.options,
    });

    api.registerCommand({
      name: 'bundle',
      description: 'Bundles JavaScript with Re.Pack.',
      action: async (args: BundleArgs) => {
        if (!args.entryFile) {
          throw new RnefError(
            '"rnef bundle" command is missing "--entry-file" argument.'
          );
        }
        intro('Compiling JS bundle with Re.Pack');
        const root = api.getProjectRoot();
        const platforms = api.getPlatforms();
        await bundleCommand.func(
          [],
          // @ts-expect-error TODO fix getPlatforms type
          { root, platforms, ...pluginConfig },
          args
        );

        if (args.hermes) {
          if (!args.bundleOutput) {
            throw new RnefError(
              'Missing "--bundle-output" argument to run "bundle --hermes".'
            );
          }

          const loader = spinner();
          loader.start('Running Hermes compiler...');
          await runHermes({
            bundleOutputPath: args.bundleOutput,
            sourcemapOutputPath: args.sourcemapOutput,
          });
          loader.stop(
            `Hermes bytecode bundle created at: ${color.cyan(
              args.bundleOutput
            )}`
          );
        } else {
          logger.info(
            `JavaScript bundle created at: ${color.cyan(args.bundleOutput)}`
          );
        }
      },
      options: [
        ...bundleCommand.options,
        {
          name: '--hermes',
          description:
            'Passes the output JS bundle to Hermes compiler and outputs a bytecode file.',
        },
      ],
    });

    return {
      name: '@rnef/plugin-repack',
      description: 'RNEF plugin for Re.Pack toolkit with Rspack.',
    };
  };

export default pluginRepack;
