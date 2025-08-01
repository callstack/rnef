import fs from 'node:fs';
import path from 'node:path';
import type {
  AndroidProjectConfig,
  Config,
} from '@react-native-community/cli-types';
import type { FingerprintSources, RemoteBuildCache } from '@rnef/tools';
import {
  color,
  formatArtifactName,
  intro,
  isInteractive,
  logger,
  outro,
  promptSelect,
  RnefError,
  spinner,
} from '@rnef/tools';
import { getBinaryPath } from '@rnef/tools';
import type { BuildFlags } from '../buildAndroid/buildAndroid.js';
import { options } from '../buildAndroid/buildAndroid.js';
import { runGradle } from '../runGradle.js';
import { toPascalCase } from '../toPascalCase.js';
import { getDevices } from './adb.js';
import type { DeviceData } from './listAndroidDevices.js';
import { listAndroidDevices } from './listAndroidDevices.js';
import { tryInstallAppOnDevice } from './tryInstallAppOnDevice.js';
import { tryLaunchAppOnDevice } from './tryLaunchAppOnDevice.js';
import { tryLaunchEmulator } from './tryLaunchEmulator.js';

export interface Flags extends BuildFlags {
  appId: string;
  appIdSuffix: string;
  mainActivity?: string;
  port: string;
  device?: string;
  binaryPath?: string;
  user?: string;
  local?: boolean;
}

export type AndroidProject = NonNullable<Config['project']['android']>;

/**
 * Starts the app on a connected Android emulator or device.
 */
export async function runAndroid(
  androidProject: AndroidProjectConfig,
  args: Flags,
  projectRoot: string,
  remoteCacheProvider: null | (() => RemoteBuildCache) | undefined,
  fingerprintOptions: FingerprintSources
) {
  intro('Running Android app');

  normalizeArgs(args, projectRoot);

  const devices = await listAndroidDevices();
  const device = await selectDevice(devices, args);

  const mainTaskType = device ? 'assemble' : 'install';
  const tasks = args.tasks ?? [`${mainTaskType}${toPascalCase(args.variant)}`];

  const artifactName = await formatArtifactName({
    platform: 'android',
    traits: [args.variant],
    root: projectRoot,
    fingerprintOptions,
  });
  const binaryPath = await getBinaryPath({
    artifactName,
    binaryPathFlag: args.binaryPath,
    localFlag: args.local,
    remoteCacheProvider,
    fingerprintOptions,
    sourceDir: androidProject.sourceDir,
  });

  if (device) {
    if (!(await getDevices()).find((d) => d === device.deviceId)) {
      // deviceId is undefined until it's launched, hence overwriting it here
      device.deviceId = await tryLaunchEmulator(device.readableName);
    }
    if (device.deviceId) {
      if (!binaryPath) {
        await runGradle({ tasks, androidProject, args, artifactName });
      }
      await runOnDevice({ device, androidProject, args, tasks, binaryPath });
    }
  } else {
    if ((await getDevices()).length === 0) {
      if (isInteractive()) {
        await selectAndLaunchDevice();
      } else {
        logger.debug(
          'No booted devices or emulators found. Launching first available emulator.'
        );
        await tryLaunchEmulator();
      }
    }

    if (!binaryPath) {
      await runGradle({ tasks, androidProject, args, artifactName });
    }

    for (const device of await listAndroidDevices()) {
      await runOnDevice({ device, androidProject, args, tasks, binaryPath });
    }
  }

  outro('Success 🎉.');
}

async function selectAndLaunchDevice() {
  const allDevices = await listAndroidDevices();
  const device = await promptForDeviceSelection(allDevices);

  if (!device.connected) {
    await tryLaunchEmulator(device.readableName);
    // list devices once again when emulator is booted
    const allDevices = await listAndroidDevices();
    const newDevice =
      allDevices.find((d) => d.readableName === device.readableName) ?? device;
    return newDevice;
  }
  return device;
}

async function selectDevice(devices: DeviceData[], args: Flags) {
  const device = args.device ? matchingDevice(devices, args.device) : undefined;
  if (!device && args.device) {
    logger.warn(
      `No devices or emulators found matching "${args.device}". Using available one instead.`
    );
  }
  return device;
}

function matchingDevice(devices: Array<DeviceData>, deviceArg: string) {
  const deviceByName = devices.find(
    (device) => device.readableName === deviceArg
  );
  const deviceById = devices.find((d) => d.deviceId === deviceArg);
  return deviceByName || deviceById;
}

function normalizeArgs(args: Flags, projectRoot: string) {
  if (args.tasks && args.variant) {
    logger.warn(
      'Both "--tasks" and "--variant" parameters were passed. Using "--tasks" for building the app.'
    );
  }

  if (!args.variant) {
    args.variant = 'debug';
  }

  // turn on activeArchOnly for debug to speed up local builds
  if (
    args.variant !== 'release' &&
    !args.variant.endsWith('Release') &&
    args.activeArchOnly === undefined &&
    isInteractive()
  ) {
    args.activeArchOnly = true;
  }

  if (args.binaryPath) {
    if (args.tasks) {
      throw new RnefError(
        'Both "--binary-path" and "--tasks" flags were specified, which are incompatible. Please specify only one.'
      );
    }

    args.binaryPath = path.isAbsolute(args.binaryPath)
      ? args.binaryPath
      : path.join(projectRoot, args.binaryPath);

    if (args.binaryPath && !fs.existsSync(args.binaryPath)) {
      throw new RnefError(
        `"--binary-path" was specified, but the file was not found at "${args.binaryPath}".`
      );
    }
  }
}

async function promptForDeviceSelection(
  allDevices: Array<DeviceData>
): Promise<DeviceData> {
  if (!allDevices.length) {
    throw new RnefError(
      'No devices and/or emulators connected. Please create emulator with Android Studio or connect Android device.'
    );
  }
  const selected = await promptSelect({
    message: 'Select the device / emulator you want to use',
    options: allDevices.map((d) => ({
      label: `${d.readableName}${
        d.type === 'phone' ? ' - (physical device)' : ''
      }${d.connected ? ' (connected)' : ''}`,
      value: d,
    })),
  });

  return selected;
}

async function runOnDevice({
  device,
  androidProject,
  args,
  tasks,
  binaryPath,
}: {
  device: DeviceData;
  androidProject: AndroidProject;
  args: Flags;
  tasks: string[];
  binaryPath: string | undefined;
}) {
  const loader = spinner();
  loader.start('Installing the app');
  await tryInstallAppOnDevice(device, androidProject, args, tasks, binaryPath);
  loader.message('Launching the app');
  const { applicationIdWithSuffix } = await tryLaunchAppOnDevice(
    device,
    androidProject,
    args
  );
  if (applicationIdWithSuffix) {
    loader.stop(
      `Installed and launched the app on ${color.bold(device.readableName)}`
    );
  } else {
    loader.stop(
      `Failed: installing and launching the app on ${color.bold(
        device.readableName
      )}`,
      1
    );
  }
}

export const runOptions = [
  ...options,
  {
    name: '--port <number>',
    description: 'Part for packager.',
    default: process.env['RCT_METRO_PORT'] || '8081',
  },
  {
    name: '--app-id <string>',
    description:
      'Specify an applicationId to launch after build. If not specified, `package` from AndroidManifest.xml will be used.',
    default: '',
  },
  {
    name: '--app-id-suffix <string>',
    description: 'Specify an applicationIdSuffix to launch after build.',
    default: '',
  },
  {
    name: '--main-activity <string>',
    description: 'Name of the activity to start',
  },
  {
    name: '--device <string>',
    description:
      'Explicitly set the device or emulator to use by name or ID (if launched).',
  },
  {
    name: '--binary-path <string>',
    description:
      'Path relative to project root where pre-built .apk binary lives.',
  },
  {
    name: '--user <number>',
    description: 'Id of the User Profile you want to install the app on.',
  },
];
