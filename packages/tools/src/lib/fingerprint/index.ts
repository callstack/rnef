import crypto from 'node:crypto';
import type { FingerprintSource } from '@expo/fingerprint';
import { createFingerprintAsync } from '@expo/fingerprint';
import { RnefError } from '../error.js';
import { processExtraSources } from './extra-sources.js';
import { buildPlatformSources } from './platform-sources.js';
import type { FingerprintOptions, FingerprintResult } from './types.js';

const HASH_ALGORITHM = 'sha1';
const EXCLUDED_SOURCES = [
  'expoAutolinkingConfig:ios',
  'expoAutolinkingConfig:android',
];

/**
 * Calculates the fingerprint of the native parts project of the project.
 */
export async function nativeFingerprint(
  path: string,
  options: FingerprintOptions
): Promise<FingerprintResult> {
  const platformSources = buildPlatformSources(options.platformConfig);
  const extraSources = processExtraSources(
    options.extraSources,
    path,
    options.ignorePaths
  );

  const fingerprint = await createFingerprintAsync(path, {
    // Disable expo fingerprint built-in platform sources
    platforms: [],
    extraSources: [...platformSources.sources, ...extraSources],
    dirExcludes: ['node_modules', ...platformSources.dirExcludes],
    ignorePaths: options.ignorePaths,
  });

  // Filter out un-relevant sources as these caused hash mismatch between local and remote builds
  const sources = fingerprint.sources.filter((source) =>
    'id' in source ? !EXCLUDED_SOURCES.includes(source.id) : true
  );

  const hash = await hashSources(sources);
  return { hash, sources };
}

async function hashSources(sources: FingerprintSource[]) {
  let input = '';
  for (const source of sources) {
    if (source.hash != null) {
      input += `${createSourceId(source)}-${source.hash}\n`;
    }
  }
  const hasher = crypto.createHash(HASH_ALGORITHM);
  hasher.update(input);
  return hasher.digest('hex');
}

function createSourceId(source: FingerprintSource) {
  switch (source.type) {
    case 'contents':
      return source.id;
    case 'file':
      return source.filePath;
    case 'dir':
      return source.filePath;
    default:
      // @ts-expect-error: we intentionally want to detect invalid types
      throw new RnefError(`Unsupported source type: ${source.type}`);
  }
}
