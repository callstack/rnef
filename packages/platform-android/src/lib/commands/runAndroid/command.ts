import type { AndroidProjectConfig } from '@react-native-community/cli-types';
import type { PluginApi } from '@rnef/config';
import { getValidProjectConfig } from '../getValidProjectConfig.js';
import type { Flags } from './runAndroid.js';
import { runAndroid, runOptions } from './runAndroid.js';

export function registerRunCommand(
  api: PluginApi,
  pluginConfig: AndroidProjectConfig | undefined,
  commandName: string
) {
  api.registerCommand({
    name: commandName,
    description:
      'Builds your app and starts it on a connected Android emulator or a device.',
    action: async (args) => {
      const projectRoot = api.getProjectRoot();
      const androidConfig = getValidProjectConfig(projectRoot, pluginConfig);
      await runAndroid(
        androidConfig,
        args as Flags,
        projectRoot,
        await api.getRemoteCacheProvider(),
        api.getFingerprintOptions()
      );
    },
    options: runOptions,
  });
}
