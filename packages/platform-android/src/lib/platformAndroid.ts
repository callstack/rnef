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
    registerBuildCommand(api, pluginConfig, 'build:android');
    registerRunCommand(api, pluginConfig, 'run:android');
    registerCreateKeystoreCommand(api, pluginConfig, 'create-keystore:keystore');
    registerSignCommand(api, 'sign:android');

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

export const platformAndroidTV =
  (pluginConfig?: PluginConfig) =>
  (api: PluginApi): PlatformOutput => {
    registerBuildCommand(api, pluginConfig, 'build:android:tv');
    registerRunCommand(api, pluginConfig, 'run:android:tv');
    registerCreateKeystoreCommand(api, pluginConfig, 'create-keystore:keystore:tv');
    registerSignCommand(api, 'sign:android:tv');

    return {
      name: '@rnef/platform-android-tv',
      description: 'RNEF plugin for everything Android TV.',
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
