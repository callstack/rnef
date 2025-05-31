import crypto from 'node:crypto';
import type { FingerprintSource } from '@expo/fingerprint';
import { createFingerprintAsync } from '@expo/fingerprint';
import { RnefError } from '../error.js';
import { processExtraSources } from './processExtraSources.js';

const HASH_ALGORITHM = 'sha1';
const EXCLUDED_SOURCES = [
  'expoAutolinkingConfig:ios',
  'expoAutolinkingConfig:android',
];

export type FingerprintSources = {
  extraSources: string[];
  ignorePaths: string[];
};

export type FingerprintOptions = {
  platform: 'ios' | 'android';
  extraSources: string[];
  ignorePaths: string[];
};

export type FingerprintResult = {
  hash: string;
  sources: FingerprintSource[];
};

/**
 * Calculates the fingerprint of the native parts project of the project.
 */
export async function nativeFingerprint(
  path: string,
  options: FingerprintOptions
): Promise<FingerprintResult> {
  const platform = options.platform;

  const fingerprint = await createFingerprintAsync(path, {
    platforms: [platform],
    dirExcludes: [
      'android/build',
      'android/**/build',
      'android/**/.cxx',
      'ios/DerivedData',
      'ios/Pods',
      'node_modules',
      'android/local.properties',
      'android/.idea',
      'android/.gradle',
    ],
    extraSources: processExtraSources(
      options.extraSources,
      path,
      options.ignorePaths
    ),
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
