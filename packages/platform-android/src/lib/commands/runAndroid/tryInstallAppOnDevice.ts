import {
  color,
  logger,
  RnefError,
  spawn,
  spinner,
  type SubprocessError,
} from '@rnef/tools';
import { getAdbPath } from './adb.js';
import { findOutputFile } from './findOutputFile.js';
import type { DeviceData } from './listAndroidDevices.js';
import { promptForUser } from './listAndroidUsers.js';
import type { AndroidProject, Flags } from './runAndroid.js';

export async function tryInstallAppOnDevice(
  device: DeviceData,
  androidProject: AndroidProject,
  args: Flags,
  tasks: string[],
  binaryPath: string | undefined
) {
  let deviceId: string;
  if (!device.deviceId) {
    logger.debug(
      `No device with id "${device.deviceId}", skipping launching the app.`
    );
    return;
  } else {
    deviceId = device.deviceId;
  }
  logger.log(`Connected to device ${color.bold(device.readableName)}`);
  let pathToApk: string;
  if (!binaryPath) {
    const outputFilePath = await findOutputFile(
      androidProject,
      tasks,
      deviceId
    );
    if (!outputFilePath) {
      logger.warn(
        "Skipping installation because there's no build output file."
      );
      return;
    }
    pathToApk = outputFilePath;
  } else {
    pathToApk = binaryPath;
  }

  const adbArgs = ['-s', deviceId, 'install', '-r', '-d'];
  const user = args.user ?? (await promptForUser(deviceId))?.id;

  if (user !== undefined) {
    adbArgs.push('--user', `${user}`);
  }

  adbArgs.push(pathToApk);

  const adbPath = getAdbPath();
  const loader = spinner();
  loader.start(`Installing the app on the device`);
  try {
    await spawn(adbPath, adbArgs, { stdio: 'pipe' });
    loader.stop(`Installed the app`);
  } catch (error) {
    loader.stop(`Failed: Installing the app`, 1);
    const errorMessage = (error as SubprocessError).output;
    const isInsufficientStorage = errorMessage.includes(
      'INSTALL_FAILED_INSUFFICIENT_STORAGE'
    );
    const isUpdateIncompatible = errorMessage.includes(
      'INSTALL_FAILED_UPDATE_INCOMPATIBLE'
    );
    if (isInsufficientStorage || isUpdateIncompatible) {
      try {
        const message = isInsufficientStorage
          ? 'Recovery: Trying to re-install the app due to insufficient storage'
          : 'Recovery: Trying to re-install the app due to binary incompatibility';
        loader.start(message);
        const appId = args.appId || androidProject.applicationId;
        await spawn(adbPath, ['-s', deviceId, 'uninstall', appId]);
        await spawn(adbPath, adbArgs);
        loader.stop(`Recovery: Re-installed the app`);
        return;
      } catch (error) {
        loader.stop(`Failed: Re-installing the app`, 1);
        const errorMessage = (error as SubprocessError).stdout;
        throw new RnefError(errorMessage);
      }
    }

    throw new RnefError(errorMessage);
  }
}
