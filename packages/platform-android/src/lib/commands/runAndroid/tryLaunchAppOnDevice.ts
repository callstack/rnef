import {
  color,
  logger,
  RnefError,
  spawn,
  spinner,
  type SubprocessError,
} from '@rnef/tools';
import { getAdbPath } from './adb.js';
import type { DeviceData } from './listAndroidDevices.js';
import type { AndroidProject, Flags } from './runAndroid.js';
import { tryRunAdbReverse } from './tryRunAdbReverse.js';

export async function tryLaunchAppOnDevice(
  device: DeviceData,
  androidProject: AndroidProject,
  args: Flags
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
  await tryRunAdbReverse(args.port, deviceId);
  const { appId, appIdSuffix } = args;
  const { packageName, mainActivity, applicationId } = androidProject;

  const applicationIdWithSuffix = [appId || applicationId, appIdSuffix]
    .filter(Boolean)
    .join('.');

  const activity = args.mainActivity ?? mainActivity;

  const activityToLaunch =
    activity.startsWith(packageName) ||
    (!activity.startsWith('.') && activity.includes('.'))
      ? activity
      : activity.startsWith('.')
      ? [packageName, activity].join('')
      : [packageName, activity].filter(Boolean).join('.');

  // Here we're using the same flags as Android Studio to launch the app
  const adbArgs = [
    'shell',
    'am',
    'start',
    '-n',
    `${applicationIdWithSuffix}/${activityToLaunch}`,
    '-a',
    'android.intent.action.MAIN',
    '-c',
    'android.intent.category.LAUNCHER',
  ];

  adbArgs.unshift('-s', deviceId);

  const adbPath = getAdbPath();
  logger.debug(`Running ${adbPath} ${adbArgs.join(' ')}.`);
  const loader = spinner();
  loader.start(
    `Launching the app on ${device.readableName} ${color.dim(
      `(id: ${deviceId})`
    )}`
  );
  try {
    await spawn(adbPath, adbArgs);
    loader.stop(
      `Launched the app ${color.bold(
        applicationIdWithSuffix
      )} and listening on port ${color.bold(args.port)}.`
    );
  } catch (error) {
    loader.stop(`Failed to launch the app.`, 1);
    throw new RnefError(`Failed to launch the app on ${device.readableName}`, {
      cause: (error as SubprocessError).stderr,
    });
  }
}
