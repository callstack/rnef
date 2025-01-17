import { spinner } from '@clack/prompts';
import {
  logger,
  RnefError,
  setupChildProcessCleanup,
  updateClock,
} from '@rnef/tools';
import spawn, { type SubprocessError } from 'nano-spawn';
import color from 'picocolors';
import type { BuildFlags } from './buildAndroid/buildAndroid.js';
import { getAdbPath, getDevices } from './runAndroid/adb.js';
import type { AndroidProject, Flags } from './runAndroid/runAndroid.js';

export type RunGradleArgs = {
  tasks: string[];
  androidProject: AndroidProject;
  args: BuildFlags | Flags;
};

export async function runGradle({
  tasks,
  androidProject,
  args,
}: RunGradleArgs) {
  if ('binaryPath' in args) {
    return;
  }
  let clockInterval;
  const loader = spinner();
  const message = `Building the app with Gradle in ${args.mode} mode`;
  if (!logger.isVerbose()) {
    loader.start(message);
    clockInterval = updateClock(loader.message, message);
  } else {
    logger.info(message);
  }

  const gradleArgs = getTaskNames(androidProject.appName, tasks);

  gradleArgs.push('-x', 'lint');

  if (args.extraParams) {
    gradleArgs.push(...args.extraParams);
  }

  if ('port' in args && args.port != null) {
    gradleArgs.push('-PreactNativeDevServerPort=' + args.port);
  }

  if (args.activeArchOnly) {
    const devices = await getDevices();
    const cpus = await Promise.all(devices.map(getCPU));
    const architectures = cpus.filter(
      (arch, index, array) => arch != null && array.indexOf(arch) === index
    );

    if (architectures.length > 0) {
      gradleArgs.push('-PreactNativeArchitectures=' + architectures.join(','));
    }
  }

  const gradleWrapper = getGradleWrapper();

  try {
    logger.debug(`Running ${gradleWrapper} ${gradleArgs.join(' ')}.`);
    const childProcess = spawn(gradleWrapper, gradleArgs, {
      cwd: androidProject.sourceDir,
      stdio: logger.isVerbose() ? 'inherit' : 'pipe',
    });
    setupChildProcessCleanup(childProcess);
    await childProcess;
    if (!logger.isVerbose()) {
      loader.stop(`Built the app in ${args.mode} mode.`);
    } else {
      logger.info(`Built the app in ${args.mode} mode.`);
    }
  } catch (error) {
    if (!logger.isVerbose()) {
      loader.stop('Failed to build the app');
    }
    const cleanedErrorMessage = (error as SubprocessError).stderr
      .split('\n')
      .filter((line) => !gradleLinesToRemove.some((l) => line.includes(l)))
      .join('\n')
      .trim();

    if (cleanedErrorMessage) {
      logger.error(cleanedErrorMessage);
    }

    const hints = getErrorHints((error as SubprocessError).stdout ?? '');
    throw new RnefError(
      hints ||
        'Failed to build the app. See the error above for details from Gradle.'
    );
  } finally {
    clearInterval(clockInterval);
  }
}

function getErrorHints(output: string) {
  const signingMessage = output.includes('validateSigningRelease FAILED')
    ? `Hint: You can run "${color.bold(
        'rnef sign:android'
      )}" to generate a keystore file.`
    : '';
  return signingMessage;
}

const gradleLinesToRemove = [
  'FAILURE: Build failed with an exception.',
  '* Try:',
  '> Run with --stacktrace option to get the stack trace.',
  '> Run with --info or --debug option to get more log output.',
  '> Run with --scan to get full insights.',
  '> Get more help at [undefined](https://help.gradle.org).',
  '> Get more help at https://help.gradle.org.',
  'BUILD FAILED',
];

export function getGradleWrapper() {
  return process.platform.startsWith('win') ? 'gradlew.bat' : './gradlew';
}

function getTaskNames(appName: string, tasks: string[]): Array<string> {
  return tasks.map((task) => `${appName}:${task}`);
}

/**
 * Gets the CPU architecture of a device from ADB
 */
async function getCPU(device: string) {
  const adbPath = getAdbPath();
  try {
    const { output } = await spawn(adbPath, [
      '-s',
      device,
      'shell',
      'getprop',
      'ro.product.cpu.abi',
    ]);
    const cpus = output.trim();
    return cpus.length > 0 ? cpus : null;
  } catch {
    return null;
  }
}
