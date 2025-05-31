import type { BuilderCommand } from '../../types/index.js';
import type { BuildFlags } from '../build/buildOptions.js';
import { getBuildOptions } from '../build/buildOptions.js';

export interface RunFlags extends BuildFlags {
  binaryPath?: string;
  port: string;
  device?: string;
  catalyst?: boolean;
  local?: boolean;
}

export const getRunOptions = ({ platformName }: BuilderCommand) => {
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
      name: '--local',
      description: 'Force local build with xcodebuild.',
    },
    {
      name: '--device <string>',
      description:
        'Explicitly set the device or simulator to use by name or by UDID.',
    },
    {
      name: '--catalyst',
      description: 'Run on Mac Catalyst.',
    },
    ...getBuildOptions({ platformName }),
  ];
};
