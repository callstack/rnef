import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type CommandType, getConfig } from '@rnef/config';
import { color, logger, resolveFilenameUp, RnefError } from '@rnef/tools';
import { Command } from 'commander';
import { checkDeprecatedOptions } from './checkDeprecatedOptions.js';
import { fingerprintPlugin } from './plugins/fingerprint.js';
import { logConfigPlugin } from './plugins/logConfig.js';
import { remoteCachePlugin } from './plugins/remoteCache.js';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = require(resolveFilenameUp(__dirname, 'package.json'));

type CliOptions = {
  cwd: string;
  argv: string[];
};

export const cli = async ({ cwd, argv }: CliOptions) => {
  if (argv) {
    logger.setVerbose(argv.includes('--verbose'));
    checkDeprecatedOptions(argv);
  }

  const program = new Command();

  program
    .name('rnef')
    .description('React Native Enterprise Framework CLI.')
    .option('--verbose', 'enable verbose logging')
    .version(version);

  const internalPlugins = [
    remoteCachePlugin,
    logConfigPlugin,
    fingerprintPlugin,
  ];
  // Register commands from the config
  const config = await getConfig(cwd, internalPlugins);

  ensureUniqueCommands(config.commands);

  config.commands?.forEach((command) => {
    const cmd = program
      .command(command.name)
      .description(command.description || '')
      .action(async (...args) => {
        try {
          await command.action(...args);
        } catch (error) {
          if (error instanceof RnefError) {
            if (logger.isVerbose()) {
              logger.error(error);
            } else {
              logger.error(error.message);
              if (error.cause) {
                logger.error(`Cause: ${error.cause}`);
              }
            }
          } else {
            logger.error(
              `Unexpected error while running "${command.name}":`,
              error
            );
          }
          process.exit(1);
        }
      });

    // Positional args
    for (const arg of command.args || []) {
      cmd.argument(arg.name, arg.description, arg.default);
    }

    // Flags
    for (const opt of command.options || []) {
      cmd.option(
        opt.name,
        opt.description,
        opt.parse ?? ((val) => val),
        opt.default
      );
    }
  });

  await program.parseAsync(argv);
};

function ensureUniqueCommands(commands: CommandType[] | undefined) {
  if (!commands) return;

  const commandNames = new Map();

  for (const command of commands) {
    if (commandNames.has(command.name)) {
      const duplicate = commandNames.get(command.name);
      const samePluginTwice = command.__origin === duplicate.__origin;
      if (samePluginTwice) {
        logger.error(`Found duplicated command "${
          command.name
        }" registered twice by the same "${
          command.__origin
        }" plugin in ${color.cyan('rnef.config.mjs')} file.
Please declare the plugin only once.`);
      } else {
        logger.error(`Found duplicated command "${
          command.name
        }" registered by 2 plugins in ${color.cyan('rnef.config.mjs')} file:
1. Added by "${command.__origin}" plugin
2. Added by "${duplicate.__origin}" plugin
Command names must be unique. Please check if you import a plugin multiple times or use incompatible plugins.`);
      }
      process.exit(1);
    }
    commandNames.set(command.name, command);
  }
}
