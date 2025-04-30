import type { BundlerPluginOutput, PluginApi } from '@rnef/config';
import { registerBundleCommand } from './bundle/command.js';
import { registerStartCommand, startDevServer } from './start/command.js';

export const pluginMetro =
  () =>
  (api: PluginApi): BundlerPluginOutput => {
    registerStartCommand(api);
    registerBundleCommand(api);

    return {
      name: '@rnef/plugin-metro',
      description: 'RNEF plugin for Metro bundler.',
      start: startDevServer,
    };
  };

export default pluginMetro;
