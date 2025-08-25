/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { logger, RockError } from '@rock-js/tools';
import type { ConfigT, InputConfigT, YargArguments } from 'metro-config';
import { loadConfig, mergeConfig, resolveConfig } from 'metro-config';
import { reactNativePlatformResolver } from './metroPlatformResolver.js';

export type ConfigLoadingContext = Readonly<{
  root: string;
  reactNativePath: string;
  platforms: Record<string, object>;
}>;

/**
 * Get the config options to override based on RN CLI inputs.
 */
function getCommunityCliDefaultConfig(
  ctx: ConfigLoadingContext,
  config: ConfigT,
): InputConfigT {
  const outOfTreePlatforms = Object.keys(ctx.platforms).filter(
    // @ts-expect-error - TBD
    (platform) => ctx.platforms[platform].npmPackageName,
  );
  const resolver: Partial<ConfigT['resolver']> = {
    platforms: [...Object.keys(ctx.platforms), 'native'],
  };

  if (outOfTreePlatforms.length) {
    // @ts-expect-error - TBD
    resolver.resolveRequest = reactNativePlatformResolver(
      outOfTreePlatforms.reduce<{ [platform: string]: string }>(
        (result, platform) => {
          // @ts-expect-error - TBD
          result[platform] = ctx.platforms[platform].npmPackageName;
          return result;
        },
        {},
      ),
      config.resolver?.resolveRequest,
    );
  }

  const require = createRequire(import.meta.url);
  return {
    resolver,
    serializer: {
      // We can include multiple copies of InitializeCore here because metro will
      // only add ones that are already part of the bundle
      getModulesRunBeforeMainModule: () => [
        require.resolve(
          path.join(ctx.reactNativePath, 'Libraries/Core/InitializeCore'),
          { paths: [ctx.root] },
        ),
        ...outOfTreePlatforms.map((platform) =>
          require.resolve(
            // @ts-expect-error - TBD
            `${ctx.platforms[platform].npmPackageName}/Libraries/Core/InitializeCore`,
            { paths: [ctx.root] },
          ),
        ),
      ],
    },
  };
}

/**
 * Load Metro config.
 *
 * Allows the CLI to override select values in `metro.config.js` based on
 * dynamic user options in `ctx`.
 */
export default async function loadMetroConfig(
  ctx: {
    platforms: Record<string, object>;
    reactNativeVersion: string;
    reactNativePath: string;
    root: string;
  },
  options: YargArguments = {},
): Promise<ConfigT> {
  const require = createRequire(import.meta.url);
  let RNMetroConfig = null;
  try {
    RNMetroConfig = await import(
      require.resolve('@react-native/metro-config', { paths: [ctx.root] })
    );
  } catch {
    throw new Error(
      "Cannot resolve `@react-native/metro-config`. Ensure it is listed in your project's `devDependencies`.",
    );
  }

  // Get the RN defaults before our customisations
  const defaultConfig = RNMetroConfig.getDefaultConfig(ctx.root);
  // Unflag the config as being loaded - it must be loaded again in userland.
  // @ts-expect-error - overriding global
  global.__REACT_NATIVE_METRO_CONFIG_LOADED = false;

  // Add our defaults to `@react-native/metro-config` before the user config
  // loads them.
  // Available since RN 0.81
  if (typeof RNMetroConfig.setFrameworkDefaults === 'function') {
    RNMetroConfig.setFrameworkDefaults(
      getCommunityCliDefaultConfig(ctx, defaultConfig),
    );
  }
  const cwd = ctx.root;
  const projectConfig = await resolveConfig(options.config, cwd);

  if (projectConfig.isEmpty) {
    throw new RockError(`No Metro config found in ${cwd}`);
  }

  logger.debug(`Reading Metro config from ${projectConfig.filepath}`);

  // @ts-expect-error - we're fine with this
  if (!global.__REACT_NATIVE_METRO_CONFIG_LOADED) {
    const warning = `
=================================================================================================
From React Native 0.73, your project's Metro config should extend '@react-native/metro-config'
or it will fail to build. Please copy the template at:
https://github.com/react-native-community/template/blob/main/template/metro.config.js
This warning will be removed in future (https://github.com/facebook/metro/issues/1018).
=================================================================================================
    `;

    for (const line of warning.trim().split('\n')) {
      console.warn(line);
    }
  }

  const config = await loadConfig({ cwd, ...options });

  if (typeof RNMetroConfig.setFrameworkDefaults === 'function') {
    return config;
  } else {
    // Fallback to the old API for RN < 0.81
    const overrideConfig = getCommunityCliDefaultConfig(ctx, config);
    return mergeConfig(config, overrideConfig);
  }
}
