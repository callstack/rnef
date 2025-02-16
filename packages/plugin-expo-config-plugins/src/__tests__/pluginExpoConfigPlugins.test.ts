import { expect, test } from 'vitest';
import { pluginExpoConfigPlugins } from '../lib/pluginExpoConfigPlugins.js';

const pluginApi = {
  registerCommand: vi.fn(),
  getProjectRoot: vi.fn(),
  getReactNativePath: vi.fn(),
  getReactNativeVersion: vi.fn(),
  getPlatforms: vi.fn(),
};

test('plugin is called with correct arguments and returns its name and description', () => {
  const plugin = pluginExpoConfigPlugins()(pluginApi);

  expect(plugin).toMatchObject({
    name: 'plugin-expo-config-plugins',
    description: 'RNEF plugin for Expo Config Plugins.',
  });
});
