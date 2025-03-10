import { performance } from 'node:perf_hooks';
import { intro, logger, nativeFingerprint, outro, spinner } from '@rnef/tools';

type NativeFingerprintCommandOptions = {
  platform: 'ios' | 'android';
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

  intro('Native Fingerprint');

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
