import type { AndroidProjectConfig } from '@react-native-community/cli-types';
import type { PluginApi } from '@rnef/config';
import type { Flags } from './runAndroid.js';
import { runAndroid, runOptions } from './runAndroid.js';

export function registerRunCommand(
  api: PluginApi,
  androidConfig: AndroidProjectConfig
) {
  api.registerCommand({
    name: 'run:android',
    description:
      'Builds your app and starts it on a connected Android emulator or a device.',
    action: async (args) => {
      const projectRoot = api.getProjectRoot();
      await runAndroid(
        androidConfig,
        args as Flags,
        projectRoot,
        api.getRemoteCacheProvider(),
        api.getFingerprintOptions(),
        api.getBundlerStart()
      );
    },
    options: runOptions,
  });
}
