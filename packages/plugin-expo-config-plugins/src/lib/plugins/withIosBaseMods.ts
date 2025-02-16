import { BaseMods } from '../ExpoConfigPlugins.js';
import { makeFilePathModifier, makeNullProvider } from '../provider.js';
import type { IosModFileProviders } from '../types.js';

// @todo rewrite template finding and copying logic
const modifyFilePath = makeFilePathModifier('node_modules/../ios/App76');

const nullProvider = makeNullProvider();

// https://github.com/expo/expo/blob/sdk-51/packages/%40expo/config-plugins/src/plugins/withIosBaseMods.ts
const expoProviders = BaseMods.getIosModFileProviders();

const defaultProviders: IosModFileProviders = {
  dangerous: expoProviders.dangerous,
  finalized: expoProviders.finalized,
  appDelegate: modifyFilePath(
    expoProviders.appDelegate,
    // @todo rewrite template finding and copying logic
    'App76/AppDelegate.swift'
  ),
  // @ts-expect-error todo fix
  expoPlist: nullProvider,
  xcodeproj: modifyFilePath(
    expoProviders.xcodeproj,
    // @todo rewrite template finding and copying logic
    'App76.xcodeproj/project.pbxproj'
  ),
  infoPlist: modifyFilePath(expoProviders.infoPlist, 'Info.plist'),
  // @ts-expect-error todo fix
  entitlements: nullProvider,
  // @ts-expect-error todo fix
  podfile: makeNullProvider({
    path: '',
    language: 'rb' as const,
    contents: '',
  }),
  // @ts-expect-error todo fix
  podfileProperties: makeNullProvider(),
};

export function getIosModFileProviders() {
  return defaultProviders;
}
