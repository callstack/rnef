import type {
  compileModsAsync as expoCompileModsAsync,
  ConfigPlugin,
  withDefaultBaseMods as expoWithDefaultBaseMods,
} from '@expo/config-plugins';
import configPlugins from '@expo/config-plugins';
import { BaseMods, evalModsAsync } from '../ExpoConfigPlugins.js';
import { getAndroidModFileProviders } from './withAndroidBaseMods.js';
import { getIosModFileProviders } from './withIosBaseMods.js';

const withDefaultBaseMods: typeof expoWithDefaultBaseMods = (config, props) => {
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

const { withPlugins, IOSConfig, AndroidConfig } = configPlugins;

/**
 * Config plugin to apply all of the custom Expo iOS config plugins we support by default.
 * TODO: In the future most of this should go into versioned packages like expo-updates, etc...
 */
export const withIosExpoPlugins: ConfigPlugin<{
  bundleIdentifier: string;
}> = (config, { bundleIdentifier }) => {
  // Set the bundle ID ahead of time.
  if (!config.ios) config.ios = {};
  config.ios.bundleIdentifier = bundleIdentifier;

  return withPlugins(config, [
    [IOSConfig.BundleIdentifier.withBundleIdentifier, { bundleIdentifier }],
    IOSConfig.Google.withGoogle,
    IOSConfig.Name.withDisplayName,
    IOSConfig.Name.withProductName,
    IOSConfig.Orientation.withOrientation,
    IOSConfig.RequiresFullScreen.withRequiresFullScreen,
    IOSConfig.Scheme.withScheme,
    IOSConfig.UsesNonExemptEncryption.withUsesNonExemptEncryption,
    IOSConfig.Version.withBuildNumber,
    IOSConfig.Version.withVersion,
    IOSConfig.Google.withGoogleServicesFile,
    IOSConfig.BuildProperties.withJsEnginePodfileProps,
    IOSConfig.BuildProperties.withNewArchEnabledPodfileProps,
    // Entitlements
    IOSConfig.Entitlements.withAssociatedDomains,
    // XcodeProject
    IOSConfig.DeviceFamily.withDeviceFamily,
    IOSConfig.Bitcode.withBitcode,
    IOSConfig.Locales.withLocales,
    IOSConfig.DevelopmentTeam.withDevelopmentTeam,
    // Dangerous
    // withIosIcons,
    IOSConfig.PrivacyInfo.withPrivacyInfo,
  ]);
};

/**
 * Config plugin to apply all of the custom Expo Android config plugins we support by default.
 * TODO: In the future most of this should go into versioned packages like expo-updates, etc...
 */
export const withAndroidExpoPlugins: ConfigPlugin<{
  package: string;
  projectRoot: string;
}> = (config, props) => {
  // Set the package name ahead of time.
  if (!config.android) config.android = {};
  config.android.package = props.package;
  return withPlugins(config, [
    // gradle.properties
    AndroidConfig.BuildProperties.withJsEngineGradleProps,
    AndroidConfig.BuildProperties.withNewArchEnabledGradleProps,

    // settings.gradle
    AndroidConfig.Name.withNameSettingsGradle,

    // project build.gradle
    AndroidConfig.GoogleServices.withClassPath,

    // app/build.gradle
    AndroidConfig.GoogleServices.withApplyPlugin,
    AndroidConfig.Package.withPackageGradle,
    AndroidConfig.Version.withVersion,

    // AndroidManifest.xml
    AndroidConfig.AllowBackup.withAllowBackup,
    AndroidConfig.WindowSoftInputMode.withWindowSoftInputMode,
    // Note: The withAndroidIntentFilters plugin must appear before the withScheme
    // plugin or withScheme will override the output of withAndroidIntentFilters.
    AndroidConfig.IntentFilters.withAndroidIntentFilters,
    AndroidConfig.Scheme.withScheme,
    AndroidConfig.Orientation.withOrientation,
    AndroidConfig.Permissions.withInternalBlockedPermissions,
    AndroidConfig.Permissions.withPermissions,

    // strings.xml
    AndroidConfig.Name.withName,
    // @ts-expect-error todo fix
    AndroidConfig.Locales.withLocales,

    // Dangerous -- these plugins run in reverse order.
    AndroidConfig.GoogleServices.withGoogleServicesFile,
    // withSdk52ReactNative77CompatAndroid,
    // withSdk52ReactNative78CompatAndroid,

    // Modify colors.xml and styles.xml
    AndroidConfig.StatusBar.withStatusBar,
    AndroidConfig.PrimaryColor.withPrimaryColor,
    // (config) => withEdgeToEdge(config, props),

    // withAndroidIcons,
    // If we renamed the package, we should also move it around and rename it in source files
    // Added last to ensure this plugin runs first. Out of tree solutions will mistakenly resolve the package incorrectly otherwise.
    AndroidConfig.Package.withPackageRefactor,
  ]);
};

export const compileModsAsync: typeof expoCompileModsAsync = async (
  config,
  props
) => {
  if (props.introspect === true) {
    console.warn('`introspect` is not supported');
  }
  console.log(config);
  // @ts-expect-error todo fix
  config.android.networkInspector = false;
  // @ts-expect-error todo fix
  config.ios.networkInspector = false;

  config = withIosExpoPlugins(config, {
    bundleIdentifier: 'org.reactjs.native.example.AppConfigPlugins',
  });
  config = withAndroidExpoPlugins(config, {
    package: 'com.appconfigplugins',
    projectRoot: props.projectRoot,
  });
  config = withDefaultBaseMods(config);
  return evalModsAsync(config, props);
};
