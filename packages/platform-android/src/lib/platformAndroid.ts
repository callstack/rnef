import type { AndroidProjectConfig } from '@react-native-community/cli-types';
import type { PlatformOutput, PluginApi } from '@rnef/config';
import { registerBuildCommand } from './commands/buildAndroid/command.js';
import { registerCreateKeystoreCommand } from './commands/generateKeystore.js';
import { getValidProjectConfig } from './commands/getValidProjectConfig.js';
import { registerRunCommand } from './commands/runAndroid/command.js';
import { registerSignCommand } from './commands/signAndroid/command.js';

type PluginConfig = AndroidProjectConfig;

export const platformAndroid =
  (pluginConfig?: PluginConfig) =>
  (api: PluginApi): PlatformOutput => {
    registerBuildCommand(api, pluginConfig);
    registerRunCommand(api, pluginConfig);
    registerCreateKeystoreCommand(api, pluginConfig);
    registerSignCommand(api);

    return {
      name: '@rnef/platform-android',
      description: 'RNEF plugin for everything Android.',
      autolinkingConfig: {
        get project() {
          const androidConfig = getValidProjectConfig(
            api.getProjectRoot(),
            pluginConfig
          );
          return { ...androidConfig };
        },
      },
    };
  };

export default platformAndroid;
