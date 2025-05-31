import type { FingerprintSource, HashSource } from '@expo/fingerprint';

export type FingerprintResult = {
  hash: string;
  sources: FingerprintSource[];
};

export type FingerprintOptions = {
  platformConfig: FingerprintPlatformConfig;
  extraSources: string[];
  ignorePaths: string[];
};

export type FingerprintPlatform = FingerprintPlatformConfig['platform'];

export type FingerprintPlatformConfig =
  | FingerprintIosPlatformConfig
  | FingerprintAndroidPlatformConfig;

export type FingerprintAndroidPlatformConfig = {
  platform: 'android';
  sourceDir: string;
};

export type FingerprintIosPlatformConfig = {
  platform: 'ios';
  sourceDir: string;
  derrivedDataDir: string;
};

export type FingerprintPlatformSources = {
  platform: FingerprintPlatform;
  sources: HashSource[];
  dirExcludes: string[];
};
