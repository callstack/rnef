import {
  color,
  logger,
  RnefError,
  spawn,
  spinner,
  type SubprocessError,
} from '@rnef/tools';
import type { AarProject, PackageAarFlags } from './aar/packageAar.js';
import type { PublishLocalAarFlags } from './aar/publishLocalAar.js';
import type { BuildFlags } from './buildAndroid/buildAndroid.js';
import { getAdbPath, getDevices } from './runAndroid/adb.js';
import type { AndroidProject, Flags } from './runAndroid/runAndroid.js';

type RunGradleAarArgs = {
  tasks: string[];
  aarProject: AarProject;
  args: PackageAarFlags | PublishLocalAarFlags;
  isPublishTask?: boolean;
};

export type RunGradleArgs = {
  tasks: string[];
  androidProject: AndroidProject;
  args: BuildFlags | Flags;
};

const getCleanedErrorMessage = (error: SubprocessError) => {
  return error.stderr
    .split('\n')
    .filter((line) => !gradleLinesToRemove.some((l) => line.includes(l)))
    .join('\n')
    .trim();
};

export async function runGradle({
  tasks,
  androidProject,
  args,
}: RunGradleArgs) {
  if ('binaryPath' in args) {
    return;
  }
  const humanReadableTasks = tasks.join(', ');

  logger.log(`Build Settings:
Variant   ${color.bold(args.variant)}
Tasks     ${color.bold(humanReadableTasks)}`);

  const loader = spinner({ indicator: 'timer' });
  const message = `Building the app`;

  loader.start(message);
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
    await spawn(gradleWrapper, gradleArgs, { cwd: androidProject.sourceDir });
    loader.stop(`Built the app`);
  } catch (error) {
    loader.stop('Failed to build the app');
    const cleanedErrorMessage = getCleanedErrorMessage(
      error as SubprocessError
    );

    if (cleanedErrorMessage) {
      logger.error(cleanedErrorMessage);
    }

    const hints = getErrorHints((error as SubprocessError).stdout ?? '');
    throw new RnefError(
      hints ||
        'Failed to build the app. See the error above for details from Gradle.'
    );
  }
}

export async function runGradleAar({
  tasks,
  aarProject,
  args,
  isPublishTask = false,
}: RunGradleAarArgs) {
  if ('binaryPath' in args) {
    return;
  }
  const loader = spinner({ indicator: 'timer' });
  const message = isPublishTask
    ? 'Publishing the AAR'
    : // @ts-expect-error args.variant is not set for publish task
      `Building the AAR with Gradle in ${args.variant} build variant`;

  loader.start(message);
  const gradleArgs = getTaskNames(aarProject.moduleName, tasks);

  gradleArgs.push('-x', 'lint');

  const gradleWrapper = getGradleWrapper();

  try {
    logger.debug(`Running ${gradleWrapper} ${gradleArgs.join(' ')}.`);
    await spawn(gradleWrapper, gradleArgs, { cwd: aarProject.sourceDir });
    loader.stop(
      isPublishTask
        ? 'Published the AAR to local maven (~/.m2/repository)'
        : // @ts-expect-error args.variant is not set for publish task
          `Built the AAR in ${args.variant} build variant.`
    );
  } catch (error) {
    loader.stop(`Failed to ${isPublishTask ? 'publish' : 'build'} the AAR`);
    const cleanedErrorMessage = getCleanedErrorMessage(
      error as SubprocessError
    );

    if (cleanedErrorMessage) {
      logger.error(cleanedErrorMessage);
    }

    const hints = getErrorHints((error as SubprocessError).stdout ?? '');
    throw new RnefError(
      hints ||
        `Failed to ${
          isPublishTask ? 'publish' : 'build'
        } the AAR. See the error above for details from Gradle.`,
      { cause: (error as SubprocessError).stderr }
    );
  }
}

function getErrorHints(output: string) {
  const signingMessage = output.includes('validateSigningRelease FAILED')
    ? `Hint: You can run "${color.bold(
        'rnef create-keystore:android'
      )}" to create a keystore file.`
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
    const { output } = await spawn(
      adbPath,
      ['-s', device, 'shell', 'getprop', 'ro.product.cpu.abi'],
      { stdio: 'pipe' }
    );
    const cpus = output.trim();
    return cpus.length > 0 ? cpus : null;
  } catch {
    return null;
  }
}
