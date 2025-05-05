import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { color, logger } from '@rnef/tools';
import type { ValidationError } from 'joi';
import { ConfigTypeSchema } from './schema.js';
import { formatValidationError } from './utils.js';

export type PluginOutput = {
  name: string;
  description: string;
};

export type PlatformOutput = PluginOutput & {
  autolinkingConfig: { project: Record<string, unknown> | undefined };
};

export type PluginApi = {
  registerCommand: (command: CommandType) => void;
  getProjectRoot: () => string;
  getReactNativeVersion: () => string;
  getReactNativePath: () => string;
  getPlatforms: () => { [platform: string]: object };
  getRemoteCacheProvider: () => SupportedRemoteCacheProviders | undefined;
  getFingerprintOptions: () => {
    extraSources: string[];
    ignorePaths: string[];
  };
};

type SupportedRemoteCacheProviders = 'github-actions';

type PluginType = (args: PluginApi) => PluginOutput;

type PlatformType = (args: PluginApi) => PlatformOutput;

type ArgValue = string | string[] | number | boolean;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActionType<T = any> = (...args: T[]) => void | Promise<void>;

export type CommandType = {
  name: string;
  description: string;
  action: ActionType;
  /** Positional arguments */
  args?: Array<{
    name: string;
    description: string;
    default?: ArgValue | undefined;
  }>;
  /** Flags */
  options?: Array<{
    name: string;
    description: string;
    default?: ArgValue | undefined;
    parse?: (value: string, previous: ArgValue) => ArgValue;
  }>;
  /** Internal property to assign plugin name to particualr commands  */
  __origin?: string;
};

export type ConfigType = {
  root?: string;
  reactNativeVersion?: string;
  reactNativePath?: string;
  bundler?: PluginType;
  plugins?: PluginType[];
  platforms?: Record<string, PlatformType>;
  commands?: Array<CommandType>;
  remoteCacheProvider?: SupportedRemoteCacheProviders;
  fingerprint?: {
    extraSources?: string[];
    ignorePaths?: string[];
  };
};

export type ConfigOutput = {
  root: string;
  commands?: Array<CommandType>;
  platforms?: Record<string, PlatformOutput>;
} & PluginApi;

const extensions = ['.js', '.ts', '.mjs'];

const importUp = async (
  dir: string,
  name: string
): Promise<{
  config: ConfigType;
  filePathWithExt: string;
  configDir: string;
}> => {
  const filePath = path.join(dir, name);

  for (const ext of extensions) {
    const filePathWithExt = `${filePath}${ext}`;
    if (fs.existsSync(filePathWithExt)) {
      let config: ConfigType;

      if (ext === '.mjs') {
        config = await import(filePathWithExt).then((module) => module.default);
      } else {
        const require = createRequire(import.meta.url);
        config = require(filePathWithExt);
      }

      return { config, filePathWithExt, configDir: dir };
    }
  }

  const parentDir = path.dirname(dir);
  if (parentDir === dir) {
    throw new Error(`${name} not found in any parent directory of ${dir}`);
  }

  return importUp(parentDir, name);
};

export async function getConfig(
  dir: string,
  internalPlugins: Array<
    (ownConfig: {
      platforms: ConfigOutput['platforms'];
      root: ConfigOutput['root'];
    }) => PluginType
  >
): Promise<ConfigOutput> {
  const { config, filePathWithExt, configDir } = await importUp(
    dir,
    'rnef.config'
  );

  const { error, value: validatedConfig } = ConfigTypeSchema.validate(
    config
  ) as {
    error: ValidationError | null;
    value: ConfigType;
  };

  if (error) {
    logger.error(
      `Invalid ${color.cyan(
        path.relative(configDir, filePathWithExt)
      )} file:\n` + formatValidationError(config, error)
    );
    process.exit(1);
  }

  const projectRoot = validatedConfig.root
    ? path.resolve(configDir, validatedConfig.root)
    : configDir;

  if (!fs.existsSync(projectRoot)) {
    logger.error(
      `Project root ${projectRoot} does not exist. Please check your config file.`
    );
    process.exit(1);
  }

  const api = {
    registerCommand: (command: CommandType) => {
      validatedConfig.commands = [...(validatedConfig.commands || []), command];
    },
    getProjectRoot: () => projectRoot,
    getReactNativeVersion: () => getReactNativeVersion(projectRoot),
    getReactNativePath: () => resolveReactNativePath(projectRoot),
    getPlatforms: () =>
      validatedConfig.platforms as { [platform: string]: object },
    getRemoteCacheProvider: () => validatedConfig.remoteCacheProvider,
    getFingerprintOptions: () =>
      validatedConfig.fingerprint as {
        extraSources: string[];
        ignorePaths: string[];
      },
  };

  if (validatedConfig.plugins) {
    // plugins register commands
    for (const plugin of validatedConfig.plugins) {
      assignOriginToCommand(plugin, api, validatedConfig);
    }
  }

  const platforms: Record<string, PlatformOutput> = {};
  if (validatedConfig.platforms) {
    // platforms register commands and custom platform functionality (TBD)
    for (const platform in validatedConfig.platforms) {
      const platformOutput = validatedConfig.platforms[platform](api);
      platforms[platform] = platformOutput;
    }
  }

  if (validatedConfig.bundler) {
    assignOriginToCommand(validatedConfig.bundler, api, validatedConfig);
  }

  for (const internalPlugin of internalPlugins) {
    assignOriginToCommand(
      internalPlugin({ root: projectRoot, platforms }),
      api,
      validatedConfig
    );
  }

  const outputConfig: ConfigOutput = {
    root: projectRoot,
    commands: validatedConfig.commands ?? [],
    platforms: platforms ?? {},
    ...api,
  };

  return outputConfig;
}

function getReactNativeVersion(root: string) {
  try {
    const require = createRequire(import.meta.url);
    return JSON.parse(
      fs.readFileSync(
        path.join(
          require.resolve('react-native', { paths: [root] }),
          '..',
          'package.json'
        ),
        'utf-8'
      )
    ).version;
  } catch {
    return 'unknown';
  }
}

function resolveReactNativePath(root: string) {
  const require = createRequire(import.meta.url);
  return path.join(require.resolve('react-native', { paths: [root] }), '..');
}

/**
 *
 * Assigns __origin property to each command in the config for later use in error handling.
 */
function assignOriginToCommand(
  plugin: PluginType,
  api: PluginApi,
  config: ConfigType
) {
  const len = config.commands?.length ?? 0;
  const { name } = plugin(api);
  const newlen = config.commands?.length ?? 0;
  for (let i = len; i < newlen; i++) {
    if (config.commands?.[i]) {
      config.commands[i].__origin = name;
    }
  }
}
