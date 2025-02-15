import fs from 'node:fs';
import { logger, RnefError, spawn, SubprocessError } from '@rnef/tools';
import { getHermescPath } from './utils.js';

type BuildJsBundleOptions = {
  bundleOutputPath: string;
  assetsDestPath: string;
  useHermes?: boolean;
};

/**
 * This function is modelled after [react-native-xcode.sh](https://github.com/facebook/react-native/blob/main/packages/react-native/scripts/react-native-xcode.sh).
 */
export async function buildJsBundle(options: BuildJsBundleOptions) {
  if (fs.existsSync(options.bundleOutputPath)) {
    fs.unlinkSync(options.bundleOutputPath);
    logger.debug('Removed existing JS bundle:', options.bundleOutputPath);
  }

  // Reasonable defaults
  // If user wants to build bundle differently, they should use `rnef bundle` command directly
  // and provide the JS bundle path to `--jsbundle` flag
  const rnefBundleArgs = [
    'bundle',
    `--entry-file`,
    `index.js`,
    '--platform',
    'ios',
    `--dev`,
    'false',
    '--minify',
    'false',
    '--reset-cache',
    '--bundle-output',
    options.bundleOutputPath,
    '--assets-dest',
    options.assetsDestPath,
  ];
  try {
    await spawn('rnef', rnefBundleArgs, {
      stdio: logger.isVerbose() ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      preferLocal: true,
    });
  } catch (error) {
    throw new RnefError('Failed to build JS bundle', {
      cause: error instanceof SubprocessError ? error.stderr : error,
    });
  }

  if (!options.useHermes) {
    return;
  }

  const hermesPath = getHermescPath();
  const hermescArgs = [
    '-emit-binary',
    '-max-diagnostic-width=80',
    '-O',
    '-w',
    '-out',
    options.bundleOutputPath,
    options.bundleOutputPath,
  ];

  try {
    await spawn(hermesPath, hermescArgs, {
      stdio: logger.isVerbose() ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    throw new RnefError(
      'Compiling JS bundle with Hermes failed. Use `--no-hermes` flag to disable Hermes.',
      {
        cause: error,
      }
    );
  }
}
