import type { BaseMods, ModPlatform } from '@expo/config-plugins';
import type {
  BaseModProviderMethods,
  ForwardedBaseModOptions,
} from '@expo/config-plugins/build/plugins/createBaseMod';

export type CustomModProvider = <
  ModType,
  Props extends ForwardedBaseModOptions
>(
  original: BaseModProviderMethods<ModType, Props>,
  file: string
) => BaseModProviderMethods<ModType, Props>;

export type IosModFileProviders = ReturnType<
  typeof BaseMods.getIosModFileProviders
> &
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Record<string, BaseModProviderMethods<any, any>>;

export type AndroidModFileProviders = ReturnType<
  typeof BaseMods.getAndroidModFileProviders
> &
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Record<string, BaseModProviderMethods<any, any>>;

export type ProjectInfo = {
  projectRoot: string;
  platforms: ModPlatform[];
  packageJsonPath: string;
  appJsonPath: string;
};
