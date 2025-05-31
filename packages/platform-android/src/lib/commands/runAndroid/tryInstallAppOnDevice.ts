import {
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
  let deviceId;
  if (!device.deviceId) {
    logger.debug(
      `No device with id "${device.deviceId}", skipping launching the app.`
    );
    return;
  } else {
    deviceId = device.deviceId;
  }
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
  loader.start(
    `Installing the app on ${device.readableName} (id: ${deviceId})`
  );
  try {
    await spawn(adbPath, adbArgs);
    loader.stop(
      `Installed the app on ${device.readableName} (id: ${deviceId}).`
    );
  } catch (error) {
    const errorMessage = (error as SubprocessError).stdout;
    if (errorMessage.includes('INSTALL_FAILED_INSUFFICIENT_STORAGE')) {
      try {
        loader.message('Trying to install again due to insufficient storage');
        const appId = args.appId ?? androidProject.applicationId;
        await spawn(adbPath, ['-s', deviceId, 'uninstall', appId]);
        await spawn(adbPath, adbArgs);
        loader.stop(
          `Installed the app on ${device.readableName} (id: ${deviceId}).`
        );
        return;
      } catch (error) {
        loader.stop(
          `Failed: Uninstalling and installing the app on ${device.readableName} (id: ${deviceId})`,
          1
        );
        const errorMessage = (error as SubprocessError).stdout;
        throw new RnefError(errorMessage);
      }
    }
    loader.stop(
      `Failed: Installing the app on ${device.readableName} (id: ${deviceId})`,
      1
    );
    throw new RnefError(errorMessage);
  }
}
