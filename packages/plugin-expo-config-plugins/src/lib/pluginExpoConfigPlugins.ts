import fs from 'node:fs';
import path from 'node:path';
import type { PluginApi, PluginOutput } from '@rnef/config';
import { applyConfigPlugins } from './apply.js';
import type { ProjectInfo } from './types.js';

type ConfigPluginsArgs = {
  platforms: string[];
};

export const pluginExpoConfigPlugins =
  () =>
  (api: PluginApi): PluginOutput => {
    api.registerCommand({
      name: 'apply-config-plugins',
      description: 'Applies config plugins to the project.',
      action: async (args: ConfigPluginsArgs) => {
        const packageJsonPath = path.join(api.getProjectRoot(), 'package.json');
        const content = fs.readFileSync(packageJsonPath, 'utf-8');
        if (!content.includes('"@expo/config-plugins"')) {
          return;
        }

        const platforms = args.platforms || Object.keys(api.getPlatforms());

        applyConfigPlugins({
          projectRoot: api.getProjectRoot(),
          platforms: platforms as ProjectInfo['platforms'],
          packageJsonPath,
          appJsonPath: path.join(api.getProjectRoot(), 'app.json'),
        });
      },
      options: [
        {
          name: '--platforms <list>',
          description: 'Platforms to apply config plugins',
          parse: (val: string) => val.split(','),
        },
      ],
    });

    return {
      name: 'plugin-expo-config-plugins',
      description: 'RNEF plugin for Expo Config Plugins.',
    };
  };

export default pluginExpoConfigPlugins;
