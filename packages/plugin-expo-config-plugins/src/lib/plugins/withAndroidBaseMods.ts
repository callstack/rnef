
import { BaseMods } from "../ExpoConfigPlugins.js";
import { makeFilePathModifier } from "../provider.js";

const modifyFilePath = makeFilePathModifier(
  // @todo rewrite template finding and copying logic
  "node_modules/../android"
);

// https://github.com/expo/expo/blob/sdk-51/packages/%40expo/config-plugins/src/plugins/withAndroidBaseMods.ts
const expoProviders = BaseMods.getAndroidModFileProviders();

/** @type {typeof expoProviders} */
const defaultProviders = {
  dangerous: expoProviders.dangerous,
  finalized: expoProviders.finalized,
  manifest: modifyFilePath(
    expoProviders.manifest,
    "app/src/main/AndroidManifest.xml"
  ),
  gradleProperties: expoProviders.gradleProperties,
  strings: modifyFilePath(
    expoProviders.strings,
    "app/src/main/res/values/strings.xml"
  ),
  colors: modifyFilePath(
    expoProviders.colors,
    "app/src/main/res/values/colors.xml"
  ),
  colorsNight: modifyFilePath(
    expoProviders.colors,
    "app/src/main/res/values-night/colors.xml"
  ),
  styles: modifyFilePath(
    expoProviders.styles,
    "app/src/main/res/values/styles.xml"
  ),
  projectBuildGradle: expoProviders.projectBuildGradle,
  settingsGradle: expoProviders.settingsGradle,
  appBuildGradle: modifyFilePath(
    expoProviders.appBuildGradle,
    "app/build.gradle"
  ),
  mainActivity: modifyFilePath(
    expoProviders.mainActivity,
    // @todo rewrite template finding and copying logic
    "app/src/main/java/com/app76/MainActivity.kt"
  ),
  mainApplication: modifyFilePath(
    expoProviders.mainApplication,
    // @todo rewrite template finding and copying logic
    "app/src/main/java/com/app76/MainApplication.kt"
  ),
};

export function getAndroidModFileProviders() {
  return defaultProviders;
}
