import fs from 'node:fs/promises';
import path from 'node:path';
import type { PluginApi, PluginOutput } from '@rock-js/config';
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
        const iosDirPath = path.join(api.getProjectRoot(), 'ios');

        const [packageJsonContent, iosDirContent] = await Promise.all([
          fs.readFile(packageJsonPath, 'utf-8'),
          fs.readdir(iosDirPath),
        ]);

        if (!packageJsonContent.includes('"@expo/config-plugins"')) {
          return;
        }

        const iosProjectName =
          iosDirContent
            .find((dir) => dir.includes('.xcodeproj'))
            ?.split('.')[0] ?? '';

        const platforms = args.platforms || Object.keys(api.getPlatforms());

        applyConfigPlugins({
          projectRoot: api.getProjectRoot(),
          platforms: platforms as ProjectInfo['platforms'],
          packageJsonPath,
          appJsonPath: path.join(api.getProjectRoot(), 'app.json'),
          iosProjectName,
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
      description: 'Rock plugin for Expo Config Plugins.',
    };
  };

export default pluginExpoConfigPlugins;
