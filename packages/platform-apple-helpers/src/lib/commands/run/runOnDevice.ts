import type { SubprocessError } from '@rnef/tools';
import { color, RnefError, spawn, spinner } from '@rnef/tools';
import type { Device } from '../../types/index.js';

export async function runOnDevice(
  selectedDevice: Device,
  binaryPath: string,
  sourceDir: string
) {
  const deviceCtlArgs = [
    'devicectl',
    'device',
    'install',
    'app',
    '--device',
    selectedDevice.udid,
    binaryPath,
  ];
  const loader = spinner();
  loader.start(
    `Installing and launching your app on ${color.bold(selectedDevice.name)}`
  );
  try {
    await spawn('xcrun', deviceCtlArgs, { cwd: sourceDir });
  } catch (error) {
    loader.stop(
      `Failed: Installing and launching your app on ${color.bold(
        selectedDevice.name
      )}`
    );
    throw new RnefError((error as SubprocessError).stderr);
  }

  loader.stop(`Installed the app on ${color.bold(selectedDevice.name)}.`);
  return;
}
