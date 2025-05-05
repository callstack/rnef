import type { AndroidProjectConfig } from '@react-native-community/cli-types';
import type { PluginApi } from '@rnef/config';
import type { BuildFlags } from './buildAndroid.js';
import { buildAndroid, options } from './buildAndroid.js';

export function registerBuildCommand(
  api: PluginApi,
  androidConfig: AndroidProjectConfig
) {
  api.registerCommand({
    name: 'build:android',
    description: 'Builds your app for Android platform.',
    action: async (args) => {
      await buildAndroid(
        androidConfig,
        args as BuildFlags,
        api.getProjectRoot(),
        api.getFingerprintOptions()
      );
    },
    options: options,
  });
}
