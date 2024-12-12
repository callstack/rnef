import { BuilderCommand } from '../../types/index.js';
import { getPlatformInfo } from '../../utils/getPlatformInfo.js';
import { BuildFlags, getBuildOptions } from '../build/buildOptions.js';

export interface RunFlags extends BuildFlags {
  simulator?: string;
  device?: string;
  udid?: string;
  binaryPath?: string;
  port: string;
}

export const getRunOptions = ({ platformName }: BuilderCommand) => {
  const { readableName } = getPlatformInfo(platformName);
  const isMac = platformName === 'macos';
  return [
    {
      name: '--port <number>',
      default: process.env['RCT_METRO_PORT'] || '8081',
    },
    {
      name: '--binary-path <string>',
      description:
        'Path relative to project root where pre-built .app binary lives.',
    },
    {
      name: '--udid <string>',
      description: 'Explicitly set the device to use by UDID',
    },
    !isMac && {
      name: '--simulator [string]',
      description: `Explicitly set the simulator to use by name or by unique device identifier. Optionally set the ${readableName} version between parentheses at the end to match an exact version: "iPhone 15 (17.0). If the value is not provided, the app will run on the first available physical device."`,
    },
    ...getBuildOptions({ platformName }),
  ];
};
