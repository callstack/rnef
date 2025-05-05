import { performance } from 'node:perf_hooks';
import type { PluginApi } from '@rnef/config';
import {
  intro,
  isInteractive,
  logger,
  nativeFingerprint,
  outro,
  spinner,
} from '@rnef/tools';

type NativeFingerprintCommandOptions = {
  platform: 'ios' | 'android';
  raw?: boolean;
};

type ConfigFingerprintOptions = {
  extraSources: string[];
  ignorePaths: string[];
};

export async function nativeFingerprintCommand(
  path = '.',
  { extraSources, ignorePaths }: ConfigFingerprintOptions,
  options?: NativeFingerprintCommandOptions
) {
  path = path ?? '.';
  const platform = options?.platform ?? 'ios';
  const readablePlatformName = platform === 'ios' ? 'iOS' : 'Android';

  if (options?.raw || !isInteractive()) {
    const fingerprint = await nativeFingerprint(path, {
      platform,
      extraSources,
      ignorePaths,
    });
    console.log(fingerprint.hash);
    return;
  }

  intro(`${readablePlatformName} Fingerprint`);

  const loader = spinner();
  loader.start("Calculating fingerprint for the project's native parts");

  const start = performance.now();
  const fingerprint = await nativeFingerprint(path, {
    platform,
    extraSources,
    ignorePaths,
  });
  const duration = performance.now() - start;

  loader.stop(`Fingerprint calculated: ${fingerprint.hash}`);

  logger.debug('Sources:', JSON.stringify(fingerprint.sources, null, 2));
  logger.debug(`Duration: ${(duration / 1000).toFixed(1)}s`);

  outro('Success 🎉.');
}

export const fingerprintPlugin = () => (api: PluginApi) => {
  api.registerCommand({
    name: 'fingerprint',
    description: 'Calculate fingerprint for given platform',
    action: async (path, options) => {
      const fingerprintOptions = api.getFingerprintOptions();
      await nativeFingerprintCommand(path, fingerprintOptions, options);
    },
    options: [
      {
        name: '-p, --platform <string>',
        description: 'Select platform, e.g. ios or android',
      },
      {
        name: '--raw',
        description: 'Output the raw fingerprint hash for piping',
      },
    ],
    args: [
      { name: 'path', description: 'Directory to calculate fingerprint for' },
    ],
  });

  return {
    name: 'internal_fingerprint',
    description: 'Fingerprint plugin',
  };
};
