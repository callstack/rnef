import { performance } from 'node:perf_hooks';
import type { PluginApi } from '@rnef/config';
import type { FingerprintSources } from '@rnef/tools';
import {
  color,
  intro,
  isInteractive,
  logger,
  nativeFingerprint,
  outro,
  RnefError,
  spinner,
} from '@rnef/tools';

type NativeFingerprintCommandOptions = {
  platform: 'ios' | 'android';
  raw?: boolean;
};

export async function nativeFingerprintCommand(
  path: string,
  { extraSources, ignorePaths }: FingerprintSources,
  options: NativeFingerprintCommandOptions
) {
  validateOptions(options);
  const platform = options.platform;
  const readablePlatformName = platform === 'ios' ? 'iOS' : 'Android';

  if (options.raw || !isInteractive()) {
    const fingerprint = await nativeFingerprint(path, {
      platform,
      extraSources,
      ignorePaths,
    });
    console.log(fingerprint.hash);
    // log sources to stderr to avoid polluting the standard output
    console.error(
      JSON.stringify(
        {
          hash: fingerprint.hash,
          sources: fingerprint.sources.filter((source) => source.hash != null),
        },
        null,
        2
      )
    );
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

  loader.stop(`Fingerprint calculated: ${color.bold(color.magenta(fingerprint.hash))}`);

  logger.debug(
    'Sources:',
    JSON.stringify(
      fingerprint.sources.filter((source) => source.hash != null),
      null,
      2
    )
  );
  logger.debug(`Duration: ${(duration / 1000).toFixed(1)}s`);

  outro('Success 🎉.');
}

function validateOptions(options: NativeFingerprintCommandOptions) {
  if (!options.platform) {
    throw new RnefError(
      'The --platform flag is required. Please specify either "ios" or "android".'
    );
  }
  if (options.platform !== 'ios' && options.platform !== 'android') {
    throw new RnefError(
      `Unsupported platform "${options.platform}". Please specify either "ios" or "android".`
    );
  }
}

export const fingerprintPlugin = () => (api: PluginApi) => {
  api.registerCommand({
    name: 'fingerprint',
    description: 'Calculate fingerprint for given platform',
    action: async (path, options) => {
      const fingerprintOptions = api.getFingerprintOptions();
      const dir = path || api.getProjectRoot();
      await nativeFingerprintCommand(dir, fingerprintOptions, options);
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
      { name: '[path]', description: 'Directory to calculate fingerprint for' },
    ],
  });

  return {
    name: 'internal_fingerprint',
    description: 'Fingerprint plugin',
  };
};
