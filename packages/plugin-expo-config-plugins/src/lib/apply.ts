
import * as fs from 'node:fs/promises';
import { withPlugins } from './ExpoConfigPlugins.js';
import { compileModsAsync } from './plugins/modCompiler.js';
import { withInternal } from './plugins/withInternal.js';
import type { ProjectInfo } from './types.js';

/**
 * Applies config plugins.
 */
export async function applyConfigPlugins({
  appJsonPath,
  ...info
}: ProjectInfo) {
  if (!appJsonPath) {
    return;
  }

  const content = await fs.readFile(appJsonPath, { encoding: 'utf-8' });
  const { plugins, ...config } = JSON.parse(content);
  if (!Array.isArray(plugins) || plugins.length === 0) {
    return;
  }
  console.log(withPlugins(withInternal(config, info), plugins));
  return compileModsAsync(
    withPlugins(withInternal(config, info), plugins),
    info
  );
}
