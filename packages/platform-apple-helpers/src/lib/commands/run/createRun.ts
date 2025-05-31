import fs from 'node:fs';
import path from 'node:path';
import type { FingerprintSources, RemoteBuildCache } from '@rnef/tools';
import {
  color,
  fetchCachedBuild,
  formatArtifactName,
  getLocalBuildCacheBinaryPath,
  isInteractive,
  logger,
  promptConfirm,
  promptSelect,
  RnefError,
  spinner,
} from '@rnef/tools';
import type {
  ApplePlatform,
  Device,
  ProjectConfig,
} from '../../types/index.js';
import { buildApp } from '../../utils/buildApp.js';
import { getGenericDestination } from '../../utils/destionation.js';
import { getPlatformInfo } from '../../utils/getPlatformInfo.js';
import { listDevicesAndSimulators } from '../../utils/listDevices.js';
import { matchingDevice } from './matchingDevice.js';
import { cacheRecentDevice, sortByRecentDevices } from './recentDevices.js';
import { runOnDevice } from './runOnDevice.js';
import { runOnMac } from './runOnMac.js';
import { runOnMacCatalyst } from './runOnMacCatalyst.js';
import { launchSimulator, runOnSimulator } from './runOnSimulator.js';
import type { RunFlags } from './runOptions.js';

export const createRun = async ({
  platformName,
  projectConfig,
  args,
  projectRoot,
  remoteCacheProvider,
  fingerprintOptions,
  reactNativePath,
}: {
  platformName: ApplePlatform;
  projectConfig: ProjectConfig;
  args: RunFlags;
  projectRoot: string;
  remoteCacheProvider: null | (() => RemoteBuildCache) | undefined;
  fingerprintOptions: FingerprintSources;
  reactNativePath: string;
}) => {
  validateArgs(args, projectRoot);
  const artifactName = await formatArtifactName({
    platform: 'ios',
    traits: [
      args.destination?.[0] ?? 'simulator',
      args.configuration ?? 'Debug',
    ],
    root: projectRoot,
    fingerprintOptions,
  });
  // 1. First check if the binary path is provided
  let binaryPath = args.binaryPath;

  // 2. If not, check if the local build is requested
  if (!binaryPath && !args.local) {
    binaryPath = getLocalBuildCacheBinaryPath(artifactName);
  }

  // 3. If not, check if the remote cache is requested
  if (!binaryPath && !args.local) {
    try {
      const cachedBuild = await fetchCachedBuild({
        artifactName,
        remoteCacheProvider,
      });
      if (cachedBuild) {
        binaryPath = cachedBuild.binaryPath;
      }
    } catch (error) {
      logger.warn((error as RnefError).message);
      const shouldContinueWithLocalBuild = await promptConfirm({
        message: 'Would you like to continue with local build?',
        confirmLabel: 'Yes',
        cancelLabel: 'No',
      });
      if (!shouldContinueWithLocalBuild) {
        throw new RnefError('Cancelled run');
      }
    }
  }

  // Check if the device argument looks like a UDID
  // (assuming UDIDs are alphanumeric and have specific length)
  const udid =
    args.device && /^[A-Fa-f0-9-]{25,}$/.test(args.device)
      ? args.device
      : undefined;

  const deviceName = udid ? undefined : args.device;

  if (platformName === 'macos') {
    const { appPath } = await buildApp({
      args: {
        destination: [getGenericDestination(platformName, 'simulator')],
        ...args,
      },
      projectConfig,
      platformName,
      projectRoot,
      udid,
      deviceName,
      reactNativePath,
      artifactName,
      binaryPath,
    });
    await runOnMac(appPath);
    return;
  } else if (args.catalyst) {
    const { appPath, scheme } = await buildApp({
      args: {
        destination: [getGenericDestination(platformName, 'simulator')],
        ...args,
      },
      projectConfig,
      platformName,
      projectRoot,
      udid,
      deviceName,
      reactNativePath,
      artifactName,
      binaryPath,
    });
    if (scheme) {
      await runOnMacCatalyst(appPath, scheme);
      return;
    } else {
      throw new RnefError('Failed to get project scheme');
    }
  }

  const loader = spinner();
  loader.start('Looking for available devices and simulators');
  const devices = await listDevicesAndSimulators(platformName);
  if (devices.length === 0) {
    const { readableName } = getPlatformInfo(platformName);
    throw new RnefError(
      `No devices or simulators detected. Install simulators via Xcode or connect a physical ${readableName} device.`
    );
  }
  loader.stop('Found available devices and simulators.');
  const device = await selectDevice(devices, args);

  if (device) {
    cacheRecentDevice(device, platformName);
    if (device.type === 'simulator') {
      const [, { appPath, infoPlistPath }] = await Promise.all([
        launchSimulator(device),
        buildApp({
          args: {
            destination: [getGenericDestination(platformName, 'simulator')],
            ...args,
          },
          projectConfig,
          platformName,
          udid: device.udid,
          projectRoot,
          reactNativePath,
          artifactName,
          binaryPath,
        }),
      ]);

      await runOnSimulator(device, appPath, infoPlistPath);
    } else if (device.type === 'device') {
      const { appPath } = await buildApp({
        args: {
          destination: [getGenericDestination(platformName, 'device')],
          ...args,
        },
        projectConfig,
        platformName,
        udid: device.udid,
        projectRoot,
        reactNativePath,
        artifactName,
        binaryPath,
      });
      await runOnDevice(device, appPath, projectConfig.sourceDir);
    }
    return;
  } else {
    const bootedSimulators = devices.filter(
      ({ state, type }) => state === 'Booted' && type === 'simulator'
    );
    if (bootedSimulators.length === 0) {
      // fallback to present all devices when no device is selected
      if (isInteractive()) {
        const simulator = await promptForDeviceSelection(devices, platformName);
        bootedSimulators.push(simulator);
        cacheRecentDevice(simulator, platformName);
      } else {
        logger.debug(
          'No booted devices or simulators found. Launching first available simulator...'
        );
        const simulator = devices.filter(
          (device) => device.type === 'simulator'
        )[0];
        if (simulator) {
          bootedSimulators.push(simulator);
        } else {
          throw new RnefError(
            'No Apple simulators found. Install simulators via Xcode.'
          );
        }
      }
    }
    for (const simulator of bootedSimulators) {
      const [, { appPath, infoPlistPath }] = await Promise.all([
        launchSimulator(simulator),
        buildApp({
          args: {
            destination: [getGenericDestination(platformName, 'simulator')],
            ...args,
          },
          projectConfig,
          platformName,
          udid: simulator.udid,
          projectRoot,
          reactNativePath,
          artifactName,
          binaryPath,
        }),
      ]);
      await runOnSimulator(simulator, appPath, infoPlistPath);
    }
  }
};

async function selectDevice(devices: Device[], args: RunFlags) {
  let device;
  if (args.device) {
    device = matchingDevice(devices, args.device);
  }
  if (!device && args.device) {
    logger.warn(
      `No devices or simulators found matching "${args.device}". Falling back to default simulator.`
    );
  }
  return device;
}

function validateArgs(args: RunFlags, projectRoot: string) {
  if (args.binaryPath) {
    args.binaryPath = path.isAbsolute(args.binaryPath)
      ? args.binaryPath
      : path.join(projectRoot, args.binaryPath);

    if (!fs.existsSync(args.binaryPath)) {
      throw new Error(
        `"--binary-path" was specified, but the file was not found at "${args.binaryPath}".`
      );
    }
    // No need to install pods if binary path is provided
    args.installPods = false;
  }
}

function promptForDeviceSelection(
  devices: Device[],
  platformName: ApplePlatform
) {
  const sortedDevices = sortByRecentDevices(devices, platformName);
  return promptSelect({
    message: 'Select the device / simulator you want to use',
    options: sortedDevices.map((d) => {
      const markDevice = d.type === 'device' ? ` - (physical device)` : '';
      return {
        label: `${d.name} ${color.dim(`(${d.version})${markDevice}`)}`,
        value: d,
      };
    }),
  });
}
