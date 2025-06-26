/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { logger, RnefError } from '@rnef/tools';
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
function getOverrideConfig(
  ctx: ConfigLoadingContext,
  config: ConfigT
): InputConfigT {
  const outOfTreePlatforms = Object.keys(ctx.platforms).filter(
    // @ts-expect-error - TBD
    (platform) => ctx.platforms[platform].npmPackageName
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
        {}
      ),
      config.resolver?.resolveRequest
    );
  }

  const require = createRequire(import.meta.url);

  // We can include multiple copies of InitializeCore here because metro will
  // only add ones that are already part of the bundle
  const initializeCorePaths = [
    require.resolve(
      path.join(ctx.reactNativePath, 'Libraries/Core/InitializeCore'),
      { paths: [ctx.root] }
    ),
    ...outOfTreePlatforms.map((platform) =>
      require.resolve(
        // @ts-expect-error - TBD
        `${ctx.platforms[platform].npmPackageName}/Libraries/Core/InitializeCore`,
        { paths: [ctx.root] }
      )
    ),
  ];

  return {
    resolver,
    serializer: {
      getModulesRunBeforeMainModule: (entrypoint) => {
        const originalBeforeMainModules =
          config.serializer.getModulesRunBeforeMainModule(entrypoint);

        // If the InitializeCore path is not specified in the original config,
        // add it to the front of the list
        const beforeMainModules = [];
        for (const modulePath of initializeCorePaths) {
          if (!originalBeforeMainModules.includes(modulePath)) {
            beforeMainModules.push(modulePath);
          }
        }

        return [...beforeMainModules, ...originalBeforeMainModules];
      },
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
  options: YargArguments = {}
): Promise<ConfigT> {
  const cwd = ctx.root;
  const projectConfig = await resolveConfig(options.config, cwd);

  if (projectConfig.isEmpty) {
    throw new RnefError(`No Metro config found in ${cwd}`);
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
  const overrideConfig = getOverrideConfig(ctx, config);

  return mergeConfig(config, overrideConfig);
}
