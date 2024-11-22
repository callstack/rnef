import spawn from 'nano-spawn';
import { AndroidProject, Flags } from './runAndroid.js';
import { getAdbPath } from './adb.js';
import { logger } from '@callstack/rnef-tools';
import { tryRunAdbReverse } from './tryRunAdbReverse.js';
import { spinner } from '@clack/prompts';

export async function tryLaunchAppOnDevice(
  device: string,
  androidProject: AndroidProject,
  args: Flags
) {
  await tryRunAdbReverse(args.port, device);
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

  adbArgs.unshift('-s', device);

  const adbPath = getAdbPath();
  logger.debug(`Running ${adbPath} ${adbArgs.join(' ')}.`);
  const loader = spinner();
  loader.start(`Installing the app on "${device}"...`);
  const { stderr } = await spawn(adbPath, adbArgs, {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  loader.stop(
    `Launched the app on "${device}" and listening on port "${args.port}".`
  );
  if (stderr) {
    logger.error(`Failed to launch the app on "${device}". ${stderr}`);
  }
}
