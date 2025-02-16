import nodefs from 'node:fs';
import * as path from 'node:path';
import { BaseMods } from './ExpoConfigPlugins.js';
import type { CustomModProvider } from './types.js';

export function makeNullProvider(defaultRead: object = {}) {
  return BaseMods.provider({
    getFilePath: () => '',
    read: () => Promise.resolve(defaultRead),
    write: () => Promise.resolve(),
  });
}

/**
 * Creates a mod modifier that just changes `getFilePath()`.
 */
export function makeFilePathModifier(
  actualProjectDir: string
): CustomModProvider {
  return function (original, file) {
    return BaseMods.provider({
      ...original,
      getFilePath: async ({ modRequest: { projectRoot } }) => {
        const name = path.posix.join(actualProjectDir, file);
        const result = findFile(name, projectRoot);
        return result || name;
      },
    });
  };
}

/**
 * Finds the specified file using Node module resolution.
 */
function findFile(
  file: string,
  startDir: string = process.cwd(),
  fs = nodefs
): string | undefined {
  let currentDir = startDir;
  let candidate = path.join(currentDir, file);
  while (!fs.existsSync(candidate)) {
    const nextDir = path.dirname(currentDir);
    if (nextDir === currentDir) {
      return undefined;
    }

    currentDir = nextDir;
    candidate = path.join(currentDir, file);
  }

  return candidate;
}
