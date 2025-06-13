import fs from 'node:fs';
import { logger, runHermes, spawn } from '@rnef/tools';

type BuildJsBundleOptions = {
  bundleOutputPath: string;
  assetsDestPath: string;
  sourcemapOutputPath: string;
  useHermes?: boolean;
};

export async function buildJsBundle(options: BuildJsBundleOptions) {
  if (fs.existsSync(options.bundleOutputPath)) {
    fs.unlinkSync(options.bundleOutputPath);
    logger.debug('Removed existing JS bundle:', options.bundleOutputPath);
  }

  if (fs.existsSync(options.sourcemapOutputPath)) {
    fs.unlinkSync(options.sourcemapOutputPath);
    logger.debug('Removed existing sourcemap:', options.sourcemapOutputPath);
  }

  if (fs.existsSync(options.assetsDestPath)) {
    fs.rmSync(options.assetsDestPath, { recursive: true });
    logger.debug('Removed existing assets:', options.assetsDestPath);
  }

  // Captured params:
  // bundle
  //   --platform android
  //   --dev false
  //   --reset-cache
  //   --entry-file <ProjectRoot>/index.js
  //   --bundle-output <ProjectRoot>/android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle
  //   --assets-dest <ProjectRoot>/android/app/build/generated/res/createBundleReleaseJsAndAssets
  //   --sourcemap-output <ProjectRoot>/android/app/build/intermediates/sourcemaps/react/release/index.android.bundle.packager.map
  //   --minify false
  //   --verbose

  // Reasonable defaults
  // If user wants to build bundle differently, they should use `rnef bundle` command directly
  // and provide the JS bundle path to `--jsbundle` flag
  const rnefBundleArgs = [
    'bundle',
    '--platform',
    'android',
    `--dev`,
    'false',
    '--reset-cache',
    `--entry-file`,
    `index.js`,
    '--bundle-output',
    options.bundleOutputPath,
    '--assets-dest',
    options.assetsDestPath,
    '--sourcemap-output',
    options.sourcemapOutputPath,
    '--minify',
    'false',
    '--verbose',
  ];
  await spawn('rnef', rnefBundleArgs, { preferLocal: true });

  if (!options.useHermes) {
    return;
  }

  await runHermes({
    bundleOutputPath: options.bundleOutputPath,
    sourcemapOutputPath: options.sourcemapOutputPath,
  });
}
