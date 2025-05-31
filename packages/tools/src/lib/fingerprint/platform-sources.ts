import type {
  FingerprintAndroidPlatformConfig,
  FingerprintIosPlatformConfig,
  FingerprintPlatformConfig,
  FingerprintPlatformSources,
} from './types.js';
import { sourceDir } from './utils.js';

const platformMap = {
  ios: buildIosPlatformSources,
  android: buildAndroidPlatformSources,
};

export function buildPlatformSources(
  config: FingerprintPlatformConfig
): FingerprintPlatformSources {
  // @ts-expect-error: Type 'FingerprintIosPlatformConfig' is not assignable to type 'never'
  return platformMap[config.platform](config);
}

export function buildIosPlatformSources(
  config: FingerprintIosPlatformConfig
): FingerprintPlatformSources {
  return {
    platform: 'ios',
    sources: [sourceDir(config.sourceDir, 'platform-ios')],
    dirExcludes: [
      `${config.sourceDir}/${config.derrivedDataDir}`,
      `${config.sourceDir}/Pods`,
    ],
  };
}

export function buildAndroidPlatformSources(
  config: FingerprintAndroidPlatformConfig
): FingerprintPlatformSources {
  return {
    platform: 'android',
    sources: [sourceDir(config.sourceDir, 'platform-android')],
    dirExcludes: [
      `${config.sourceDir}/build`,
      `${config.sourceDir}/**/build`,
      `${config.sourceDir}/**/.cxx`,
      `${config.sourceDir}/local.properties`,
      `${config.sourceDir}/.idea`,
      `${config.sourceDir}/.gradle`,
    ],
  };
}
