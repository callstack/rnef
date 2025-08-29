import crypto from 'node:crypto';
import path from 'node:path';
import type { FingerprintSource, HashSource } from '@expo/fingerprint';
import { createFingerprintAsync } from '@expo/fingerprint';
import { RockError } from '../error.js';
import logger from '../logger.js';
import { spawn } from '../spawn.js';
import { processExtraSources } from './processExtraSources.js';
export { DEFAULT_IGNORE_PATHS as EXPO_DEFAULT_IGNORE_PATHS } from '@expo/fingerprint';

const HASH_ALGORITHM = 'sha1';
const EXCLUDED_SOURCES = [
  'expoAutolinkingConfig:ios',
  'expoAutolinkingConfig:android',
];

export const DEFAULT_IGNORE_PATHS = [
  'android/build',
  'android/**/build',
  'android/**/.cxx',
  'android/.kotlin/**',
  'ios/DerivedData',
  'ios/Pods',
  'ios/tmp.xcconfig', // added by react-native-config
  'ios/**/*.xcworkspace',
  'node_modules',
  'android/local.properties',
  'android/.idea',
  'android/.gradle',
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
  projectRoot: string,
  options: FingerprintOptions,
): Promise<FingerprintResult> {
  const platform = options.platform;
  // Use stdout to avoid deprecation warnings
  const { stdout: autolinkingConfigString } = await spawn(
    'rock',
    ['config', '-p', options.platform],
    { cwd: projectRoot, stdio: 'pipe', preferLocal: true },
  );

  const autolinkingSources = parseAutolinkingSources({
    config: JSON.parse(autolinkingConfigString),
    reasons: ['rncoreAutolinking'],
    contentsId: 'rncoreAutolinkingConfig',
  });

  const fingerprint = await createFingerprintAsync(projectRoot, {
    platforms: [platform],
    extraSources: [
      ...autolinkingSources,
      ...processExtraSources(
        options.extraSources,
        projectRoot,
        options.ignorePaths,
      ),
    ],
    ignorePaths: [...DEFAULT_IGNORE_PATHS, ...(options.ignorePaths ?? [])],
  });

  // Filter out un-relevant sources as these caused hash mismatch between local and remote builds
  const sources = fingerprint.sources.filter((source) =>
    'id' in source ? !EXCLUDED_SOURCES.includes(source.id) : true,
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
      throw new RockError(`Unsupported source type: ${source.type}`);
  }
}

function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function parseAutolinkingSources({
  config,
  reasons,
  contentsId,
}: {
  config: any;
  reasons: string[];
  contentsId: string;
}): HashSource[] {
  const results: HashSource[] = [];
  const { root } = config;
  const autolinkingConfig: Record<string, any> = {};
  for (const [depName, depData] of Object.entries<any>(config.dependencies)) {
    try {
      stripAutolinkingAbsolutePaths(depData, root);
      const filePath = toPosixPath(depData.root);
      results.push({ type: 'dir', filePath, reasons });

      autolinkingConfig[depName] = depData;
    } catch (e) {
      logger.debug(
        `Error adding react-native core autolinking - ${depName}.\n${e}`,
      );
    }
  }
  results.push({
    type: 'contents',
    id: contentsId,
    contents: JSON.stringify(autolinkingConfig),
    reasons,
  });
  return results;
}

function stripAutolinkingAbsolutePaths(dependency: any, root: string): void {
  const dependencyRoot = dependency.root;
  const cmakeDepRoot =
    process.platform === 'win32' ? toPosixPath(dependencyRoot) : dependencyRoot;

  dependency.root = toPosixPath(path.relative(root, dependencyRoot));
  for (const platformData of Object.values<any>(dependency.platforms)) {
    for (const [key, value] of Object.entries<any>(platformData ?? {})) {
      let newValue;
      if (
        process.platform === 'win32' &&
        ['cmakeListsPath', 'cxxModuleCMakeListsPath'].includes(key)
      ) {
        // CMake paths on Windows are serving in slashes,
        // we have to check startsWith with the same slashes.
        // @todo revisit windows logic
        newValue = value?.startsWith?.(cmakeDepRoot)
          ? toPosixPath(path.relative(root, value))
          : value;
      } else {
        newValue = value?.startsWith?.(dependencyRoot)
          ? toPosixPath(path.relative(root, value))
          : value;
      }
      platformData[key] = newValue;
    }
  }
}
