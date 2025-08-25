import type {
  compileModsAsync as expoCompileModsAsync,
  withDefaultBaseMods as expoWithDefaultBaseMods,
} from '@expo/config-plugins';
import { BaseMods, evalModsAsync } from '../ExpoConfigPlugins.js';
import { getAndroidModFileProviders } from './withAndroidBaseMods.js';
import { getIosModFileProviders } from './withIosBaseMods.js';

export const withDefaultBaseMods: typeof expoWithDefaultBaseMods = (
  config,
  props
) => {
  config = BaseMods.withIosBaseMods(config, {
    ...props,
    providers: getIosModFileProviders(),
  });
  config = BaseMods.withAndroidBaseMods(config, {
    ...props,
    providers: getAndroidModFileProviders(),
  });
  return config;
};

export const compileModsAsync: typeof expoCompileModsAsync = (
  config,
  props
) => {
  if (props.introspect === true) {
    console.warn('`introspect` is not supported by react-native-test-app');
  }

  config = withDefaultBaseMods(config);
  return evalModsAsync(config, props);
};
