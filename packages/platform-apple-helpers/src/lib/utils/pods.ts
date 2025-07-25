import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { IOSDependencyConfig } from '@react-native-community/cli-types';
import type { SubprocessError } from '@rnef/tools';
import {
  cacheManager,
  color,
  colorLink,
  logger,
  RnefError,
  spawn,
  spinner,
} from '@rnef/tools';
import type { ApplePlatform } from '../types/index.js';
import runCodegen from './codegen.js';

const podErrorHelpMessage = `Please make sure your environment is correctly set up. 
Learn more at: ${color.dim('https://cocoapods.org/')}
To skip automatic CocoaPods installation run with "--no-install-pods" flag after installing CocoaPods manually.`;

export async function installPodsIfNeeded(
  projectRoot: string,
  platformName: ApplePlatform,
  sourceDir: string,
  newArch: boolean,
  reactNativePath: string,
  brownfield?: boolean
) {
  const podsPath = path.join(sourceDir, 'Pods');
  const podfilePath = path.join(sourceDir, 'Podfile');

  // There's a possibility to define a custom dependencies in `react-native.config.js`, that contain native code for a platform and that should also trigger install CocoaPods
  const nativeDependencies = await getNativeDependencies(platformName);

  const cacheKey = `pods-dependencies`;
  const cachedDependenciesHash = cacheManager.get(cacheKey);
  const podsDirExists = fs.existsSync(podsPath);
  const hashChanged = cachedDependenciesHash
    ? !compareMd5Hashes(
        calculateCurrentHash({ podfilePath, podsPath, nativeDependencies }),
        cachedDependenciesHash
      )
    : true;

  if (!podsDirExists || hashChanged) {
    await runCodegen({ projectRoot, platformName, reactNativePath, sourceDir });
    await installPods({
      projectRoot,
      sourceDir,
      podfilePath,
      newArch,
      brownfield,
    });
    cacheManager.set(
      cacheKey,
      calculateCurrentHash({ podfilePath, podsPath, nativeDependencies })
    );
  }
}

const calculateCurrentHash = ({
  podfilePath,
  podsPath,
  nativeDependencies,
}: {
  podfilePath: string;
  podsPath: string;
  nativeDependencies: string[];
}) => {
  const podfileLockPath = podfilePath + '.lock';
  const manifestLockPath = path.join(podsPath, 'Manifest.lock');
  let podfile;
  try {
    podfile = fs.readFileSync(podfilePath, 'utf-8');
  } catch {
    throw new RnefError(
      `No Podfile found at: ${podfilePath}.
${podErrorHelpMessage}`
    );
  }

  let podfileLock: string | undefined;
  try {
    podfileLock = fs.readFileSync(podfileLockPath, 'utf-8');
  } catch {
    logger.debug('No Podfile.lock, continue');
  }
  return generateDependenciesHash([
    generateMd5Hash(podfile),
    generateMd5Hash(podfileLock ?? ''),
    getLockfileChecksum(podfileLockPath),
    getLockfileChecksum(manifestLockPath),
    generateDependenciesHash(nativeDependencies),
  ]);
};

async function runPodInstall(options: {
  shouldHandleRepoUpdate?: boolean;
  sourceDir: string;
  newArch: boolean;
  useBundler: boolean;
  brownfield?: boolean;
}) {
  if (!options.useBundler) {
    await validatePodCommand(options.sourceDir);
  }

  // Remove build folder to avoid codegen path clashes when developing native modules
  if (fs.existsSync('./build')) {
    fs.rmSync('build', { recursive: true });
  }

  const shouldHandleRepoUpdate = options?.shouldHandleRepoUpdate || true;
  const loader = spinner({ indicator: 'timer' });
  loader.start('Installing CocoaPods dependencies');

  const command = options.useBundler ? 'bundle' : 'pod';
  const args = options.useBundler ? ['exec', 'pod', 'install'] : ['install'];
  try {
    await spawn(command, args, {
      env: {
        RCT_NEW_ARCH_ENABLED: options.newArch ? '1' : '0',
        RCT_IGNORE_PODS_DEPRECATION: '1',
        ...(options.brownfield && { USE_FRAMEWORKS: 'static' }),
        ...(process.env['USE_THIRD_PARTY_JSC'] && {
          USE_THIRD_PARTY_JSC: process.env['USE_THIRD_PARTY_JSC'],
        }),
        ...(process.env['RCT_USE_RN_DEP'] && {
          RCT_USE_RN_DEP: process.env['RCT_USE_RN_DEP'],
        }),
        ...(process.env['RCT_USE_PREBUILT_RNCORE'] && {
          RCT_USE_PREBUILT_RNCORE: process.env['RCT_USE_PREBUILT_RNCORE'],
        }),
      },
      cwd: options.sourceDir,
    });
  } catch (error) {
    loader.stop('Failed: Installing CocoaPods dependencies', 1);
    const stderr =
      (error as SubprocessError).stderr || (error as SubprocessError).output;
    /**
     * If CocoaPods failed due to repo being out of date, it will
     * include the update command in the error message.
     *
     * `shouldHandleRepoUpdate` will be set to `false` to
     * prevent infinite loop (unlikely scenario)
     */
    if (stderr.includes('pod repo update') && shouldHandleRepoUpdate) {
      await runPodUpdate(options.sourceDir, options.useBundler);
      await runPodInstall({
        shouldHandleRepoUpdate: false,
        sourceDir: options.sourceDir,
        newArch: options.newArch,
        useBundler: options.useBundler,
        brownfield: options.brownfield,
      });
    } else {
      throw new RnefError(
        `CocoaPods installation failed. 
${podErrorHelpMessage}`,
        { cause: stderr }
      );
    }
  }

  loader.stop('Installed CocoaPods dependencies successfully');
}

async function runPodUpdate(cwd: string, useBundler: boolean) {
  const loader = spinner({ indicator: 'timer' });
  try {
    loader.start('Updating CocoaPods repositories');
    if (useBundler) {
      await spawn('bundle', ['exec', 'pod', 'repo', 'update'], { cwd });
    } else {
      await spawn('pod', ['repo', 'update'], { cwd });
    }
  } catch (error) {
    const stderr =
      (error as SubprocessError).stderr || (error as SubprocessError).stdout;
    loader.stop('Failed: Updating CocoaPods repositories', 1);

    throw new RnefError(
      `Failed to update CocoaPods repositories for iOS project.
${podErrorHelpMessage}`,
      { cause: stderr }
    );
  }
}

async function installPods(options: {
  sourceDir: string;
  projectRoot: string;
  podfilePath: string;
  newArch: boolean;
  brownfield?: boolean;
}) {
  if (!fs.existsSync(options.podfilePath)) {
    logger.debug(
      `No Podfile at ${options.podfilePath}. Skipping pod installation.`
    );
    return;
  }
  const useBundler = await runBundleInstall(
    options.sourceDir,
    options.projectRoot
  );
  if (!useBundler) {
    logger.info('Unable to use Ruby bundler, falling back to "pod install"');
  }
  await runPodInstall({
    sourceDir: options.sourceDir,
    newArch: options.newArch,
    useBundler,
    brownfield: options.brownfield,
  });
}

/*
 * Check if "pod" is available and usable. It happens that there are
 * multiple versions of "pod" command and even though it's there, it exits
 * with a failure
 */
async function validatePodCommand(sourceDir: string) {
  try {
    await spawn('pod', ['--version'], { cwd: sourceDir });
  } catch (error) {
    const cause = (error as SubprocessError).cause;
    if (cause instanceof Error && cause.message.includes('ENOENT')) {
      throw new RnefError(
        `The "pod" command is not available.
${podErrorHelpMessage}`
      );
    }
    const stderr =
      (error as SubprocessError).stderr || (error as SubprocessError).stdout;
    throw new RnefError(
      `CocoaPods "pod" command failed.
${podErrorHelpMessage}`,
      { cause: stderr }
    );
  }
}

function checkGemfileForCocoaPods(gemfilePath: string): boolean {
  try {
    const gemfileContent = fs.readFileSync(gemfilePath, 'utf-8');
    // Check for common CocoaPods gem declarations, because some projects might have Gemfile but for other purposes
    return /^\s*gem\s+['"]cocoapods['"]/m.test(gemfileContent);
  } catch (error) {
    logger.debug(`Failed to read Gemfile at: ${gemfilePath}`);
    logger.debug(error);
    return false;
  }
}

async function runBundleInstall(sourceDir: string, projectRoot: string) {
  const gemfilePath = path.join(projectRoot, 'Gemfile');
  if (!fs.existsSync(gemfilePath)) {
    logger.debug(
      `Could not find the Gemfile at: ${colorLink(gemfilePath)}
The default React Native Template uses Gemfile to leverage Ruby Bundler and we advice the same.
If you use Gemfile, make sure it's ${color.bold(
        'in the project root directory'
      )}.
Falling back to installing CocoaPods using globally installed "pod".`
    );
    return false;
  }

  if (!checkGemfileForCocoaPods(gemfilePath)) {
    logger.debug(
      `CocoaPods not found in Gemfile at: ${colorLink(gemfilePath)}
skipping Ruby Gems installation.`
    );
    return false;
  }

  const loader = spinner();
  try {
    loader.start('Installing Ruby Gems');
    await spawn('bundle', ['install'], { cwd: sourceDir });
  } catch (error) {
    const stderr =
      (error as SubprocessError).stderr || (error as SubprocessError).stdout;
    loader.stop('Failed: Installing Ruby Gems', 1);
    throw new RnefError(
      `Failed to install Ruby Gems with "bundle install".
${podErrorHelpMessage}`,
      { cause: stderr }
    );
  }

  loader.stop('Installed Ruby Gems');
  return true;
}

async function getNativeDependencies(platformName: ApplePlatform) {
  const { loadConfigAsync } = await import(
    '@react-native-community/cli-config'
  );
  const config = await loadConfigAsync({ selectedPlatform: platformName });
  const dependencies = config.dependencies;
  return Object.keys(dependencies)
    .filter((dependency) => dependencies[dependency].platforms?.[platformName])
    .map(
      (dependency) =>
        `${dependency}@${
          (
            dependencies[dependency].platforms?.[
              platformName
            ] as IOSDependencyConfig
          ).version
        }`
    )
    .sort();
}

function generateMd5Hash(text: string) {
  return createHash('md5').update(text).digest('hex');
}

function compareMd5Hashes(hash1: string, hash2: string) {
  return hash1 === hash2;
}

function generateDependenciesHash(deps: string[]) {
  return generateMd5Hash(JSON.stringify(deps));
}

/**
 * Gets the checksum of Podfile.lock or Pods/Manifest.lock
 */
function getLockfileChecksum(lockfilePath: string) {
  try {
    const checksumLine = fs
      .readFileSync(lockfilePath, 'utf8')
      .split('\n')
      .find((line) => line.includes('PODFILE CHECKSUM'));

    if (checksumLine) {
      return checksumLine.split(': ')[1];
    }
  } catch (error) {
    logger.debug(`Failed to load the lockfile ${lockfilePath}`, error);
  }
  return '';
}
