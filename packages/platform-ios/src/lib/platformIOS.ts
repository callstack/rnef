import type { IOSProjectConfig } from '@react-native-community/cli-types';
import type { PlatformOutput, PluginApi } from '@rnef/config';
import type { BuildFlags, RunFlags } from '@rnef/platform-apple-helpers';
import {
  createBuild,
  createRun,
  getBuildOptions,
  getRunOptions,
  getValidProjectConfig,
} from '@rnef/platform-apple-helpers';
import { intro, outro } from '@rnef/tools';
import { registerSignCommand } from './commands/signIos.js';

const buildOptions = getBuildOptions({ platformName: 'ios' });
const runOptions = getRunOptions({ platformName: 'ios' });

export const platformIOS =
  (pluginConfig?: IOSProjectConfig) =>
  (api: PluginApi): PlatformOutput => {
    const projectRoot = api.getProjectRoot();
    const iosConfig = getValidProjectConfig('ios', projectRoot, pluginConfig);
    api.registerCommand({
      name: 'build:ios',
      description: 'Build iOS app.',
      action: async (args) => {
        intro('Building iOS app');
        await createBuild({
          platformName: 'ios',
          projectConfig: iosConfig,
          args: args as BuildFlags,
          projectRoot,
          reactNativePath: api.getReactNativePath(),
        });
        outro('Success 🎉.');
      },
      options: buildOptions,
    });

    api.registerCommand({
      name: 'run:ios',
      description: 'Run iOS app.',
      action: async (args) => {
        intro('Running iOS app');
        await createRun({
          platformName: 'ios',
          projectConfig: iosConfig,
          args: args as RunFlags,
          projectRoot,
          remoteCacheProvider: api.getRemoteCacheProvider(),
          fingerprintOptions: api.getFingerprintOptions(),
          reactNativePath: api.getReactNativePath(),
        });
        outro('Success 🎉.');
      },
      // @ts-expect-error: fix `simulator` is not defined in `RunFlags`
      options: runOptions,
    });

    registerSignCommand(api);

    return {
      name: '@rnef/platform-ios',
      description: 'RNEF plugin for everything iOS.',
      autolinkingConfig: { project: { ...iosConfig } },
    };
  };

export default platformIOS;
