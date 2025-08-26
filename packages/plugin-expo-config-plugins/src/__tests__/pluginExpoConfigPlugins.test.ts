import { expect, test, beforeEach, afterEach } from 'vitest';
import { cleanup, getTempDirectory } from '@rock-js/test-helpers';
import { pluginExpoConfigPlugins } from '../lib/pluginExpoConfigPlugins.js';
import path from 'node:path';
import * as fs from 'node:fs/promises';
import { withInternal } from '../lib/plugins/withInternal.js';
import { ProjectInfo } from '../lib/types.js';
import {
  evalModsAsync,
  IOSConfig,
  withDefaultBaseMods,
  withPlugins,
} from '@expo/config-plugins';
import * as plist from 'plist';

let TEMP_DIR: string;

const pluginApi = {
  registerCommand: vi.fn(),
  getProjectRoot: vi.fn(),
  getReactNativePath: vi.fn(),
  getReactNativeVersion: vi.fn(),
  getPlatforms: vi.fn(),
  getRemoteCacheProvider: vi.fn(),
  getFingerprintOptions: vi.fn(),
};

beforeEach(async () => {
  TEMP_DIR = getTempDirectory('expo-config-plugins-test-app');

  const testAppPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'apps',
    'expo-config-plugins-test-app',
  );
  await fs.cp(testAppPath, TEMP_DIR, { recursive: true });

  pluginApi.getProjectRoot.mockReturnValue(TEMP_DIR);
});

afterEach(() => {
  if (TEMP_DIR) {
    cleanup(TEMP_DIR);
  }
});

async function getTestConfig() {
  const appJsonPath = path.join(pluginApi.getProjectRoot(), 'app.json');
  const iosDirPath = path.join(pluginApi.getProjectRoot(), 'ios');

  const [appJsonContent, iosDirContent] = await Promise.all([
    fs.readFile(appJsonPath, 'utf-8'),
    fs.readdir(iosDirPath),
  ]);

  const { expo, ...rest } = JSON.parse(appJsonContent);
  const appJsonConfig = expo || rest;

  const iosProjectName =
    iosDirContent.find((dir) => dir.includes('.xcodeproj'))?.split('.')[0] ??
    '';

  const info = {
    projectRoot: pluginApi.getProjectRoot(),
    platforms: ['ios'] as ProjectInfo['platforms'],
    packageJsonPath: path.join(pluginApi.getProjectRoot(), 'package.json'),
    appJsonPath,
    iosProjectName,
  };

  let config = withInternal(appJsonConfig, info);

  return { config, info };
}

async function parsePlistForKey(path: string, key: string) {
  const infoPlistContent = await fs.readFile(path, 'utf8');
  const parsed = plist.parse(infoPlistContent) as Record<
    string,
    plist.PlistValue
  >;

  return parsed[key];
}

test('plugin is called with correct arguments and returns its name and description', () => {
  const plugin = pluginExpoConfigPlugins()(pluginApi);

  expect(plugin).toMatchObject({
    name: 'plugin-expo-config-plugins',
    description: 'Rock plugin for Expo Config Plugins.',
  });
});

describe('plugin applies default iOS config plugins correctly', () => {
  test('withBundleIdentifier', async () => {
    let { config, info } = await getTestConfig();

    if (!config.ios) config.ios = {};
    config.ios.bundleIdentifier = 'dev.rockjs.test';

    config = withPlugins(config, [
      [
        IOSConfig.BundleIdentifier.withBundleIdentifier,
        { bundleIdentifier: config.ios?.bundleIdentifier },
      ],
    ]);

    config = withDefaultBaseMods(config);

    const projectPbxprojPath = path.join(
      TEMP_DIR,
      'ios',
      `${info.iosProjectName}.xcodeproj`,
      'project.pbxproj',
    );

    // Check the initial bundle identifier
    const projectContent = await fs.readFile(projectPbxprojPath, 'utf8');
    expect(projectContent).toContain(
      'PRODUCT_BUNDLE_IDENTIFIER = "org.reactjs.native.example',
    );

    // Apply the plugin
    await evalModsAsync(config, info);

    // Check the changed bundle identifier
    const changedProjectContent = await fs.readFile(projectPbxprojPath, 'utf8');
    expect(changedProjectContent).toContain(
      `PRODUCT_BUNDLE_IDENTIFIER = "${config.ios?.bundleIdentifier}";`,
    );
  });

  test.skip('withGoogle', async () => {
    let { config, info } = await getTestConfig();

    config = withPlugins(config, [IOSConfig.Google.withGoogle]);

    config = withDefaultBaseMods(config);

    // Check something

    // Apply the plugin
    await evalModsAsync(config, info);
  });

  test('withDisplayName', async () => {
    let { config, info } = await getTestConfig();

    // Edit the display name
    config.name = 'TestAppEditedName';

    config = withPlugins(config, [IOSConfig.Name.withDisplayName]);
    config = withDefaultBaseMods(config);

    const infoPlistPath = path.join(
      TEMP_DIR,
      'ios',
      info.iosProjectName,
      'Info.plist',
    );

    // Check initial state
    const initialDisplayName = await parsePlistForKey(
      infoPlistPath,
      'CFBundleDisplayName',
    );

    expect(initialDisplayName).toBe(info.iosProjectName);

    // Apply the plugin
    await evalModsAsync(config, info);

    // Check that display name was updated
    const changedDisplayName = await parsePlistForKey(
      infoPlistPath,
      'CFBundleDisplayName',
    );

    expect(changedDisplayName).toBe(config.name);
  });

  test('withProductName', async () => {
    let { config, info } = await getTestConfig();

    // Edit the product name
    config.name = 'TestProductName';

    config = withPlugins(config, [IOSConfig.Name.withProductName]);

    config = withDefaultBaseMods(config);

    const projectPbxprojPath = path.join(
      TEMP_DIR,
      'ios',
      `${info.iosProjectName}.xcodeproj`,
      'project.pbxproj',
    );

    // Check initial state
    const projectContent = await fs.readFile(projectPbxprojPath, 'utf8');
    expect(projectContent).toContain(`PRODUCT_NAME = ${info.iosProjectName}`);

    // Apply the plugin
    await evalModsAsync(config, info);

    // Check that product name was updated
    const changedProjectContent = await fs.readFile(projectPbxprojPath, 'utf8');
    expect(changedProjectContent).toContain(`PRODUCT_NAME = "${config.name}"`);
  });

  test('withOrientation', async () => {
    let { config, info } = await getTestConfig();

    // Add orientation configuration to the config
    config.orientation = 'landscape';

    config = withPlugins(config, [IOSConfig.Orientation.withOrientation]);

    config = withDefaultBaseMods(config);

    const infoPlistPath = path.join(
      TEMP_DIR,
      'ios',
      info.iosProjectName,
      'Info.plist',
    );

    const initialOrientation = await parsePlistForKey(
      infoPlistPath,
      'UISupportedInterfaceOrientations',
    );

    expect(initialOrientation).toContain('UIInterfaceOrientationPortrait');
    expect(initialOrientation).toContain('UIInterfaceOrientationLandscapeLeft');
    expect(initialOrientation).toContain(
      'UIInterfaceOrientationLandscapeRight',
    );

    // Apply the plugin
    await evalModsAsync(config, info);

    // Check that orientation was updated
    const changedOrientation = await parsePlistForKey(
      infoPlistPath,
      'UISupportedInterfaceOrientations',
    );

    expect(changedOrientation).not.toContain('UIInterfaceOrientationPortrait');
    expect(changedOrientation).toContain('UIInterfaceOrientationLandscapeLeft');
    expect(changedOrientation).toContain(
      'UIInterfaceOrientationLandscapeRight',
    );
  });

  test('withRequiresFullScreen', async () => {
    let { config, info } = await getTestConfig();

    // Add requires full screen configuration to the config
    if (!config.ios) config.ios = {};
    config.ios.requireFullScreen = true;

    config = withPlugins(config, [
      IOSConfig.RequiresFullScreen.withRequiresFullScreen,
    ]);

    config = withDefaultBaseMods(config);

    const infoPlistPath = path.join(
      TEMP_DIR,
      'ios',
      info.iosProjectName,
      'Info.plist',
    );

    // Check initial state
    const initialRequiresFullScreen = await parsePlistForKey(
      infoPlistPath,
      'UIRequiresFullScreen',
    );

    expect(initialRequiresFullScreen).toBeUndefined();

    // Apply the plugin
    await evalModsAsync(config, info);

    // Check that requires full screen was added
    const changedRequiresFullScreen = await parsePlistForKey(
      infoPlistPath,
      'UIRequiresFullScreen',
    );
    expect(changedRequiresFullScreen).toBe(true);
  });

  test('withScheme', async () => {
    let { config, info } = await getTestConfig();

    // Add scheme to the config
    config.scheme = 'dev.rockjs.test';

    config = withPlugins(config, [IOSConfig.Scheme.withScheme]);

    config = withDefaultBaseMods(config);

    const infoPlistPath = path.join(
      TEMP_DIR,
      'ios',
      info.iosProjectName,
      'Info.plist',
    );

    // Check initial state
    const initialScheme = await parsePlistForKey(
      infoPlistPath,
      'CFBundleURLTypes',
    );

    expect(initialScheme).toBeUndefined();

    // Apply the plugin
    await evalModsAsync(config, info);

    // Check that scheme was added
    const urlTypes = (await parsePlistForKey(
      infoPlistPath,
      'CFBundleURLTypes',
    )) as plist.PlistObject[];

    const changedScheme = urlTypes[0]['CFBundleURLSchemes'];

    expect(changedScheme).toContain(config.scheme);
  });

  test('withUsesNonExemptEncryption', async () => {
    let { config, info } = await getTestConfig();

    // Add uses non exempt encryption to the config
    if (!config.ios) {
      config.ios = {
        config: {
          usesNonExemptEncryption: true,
        },
      };
    }

    config = withPlugins(config, [
      IOSConfig.UsesNonExemptEncryption.withUsesNonExemptEncryption,
    ]);

    config = withDefaultBaseMods(config);

    const infoPlistPath = path.join(
      TEMP_DIR,
      'ios',
      info.iosProjectName,
      'Info.plist',
    );

    // Check initial state
    const initialUsesNonExemptEncryption = await parsePlistForKey(
      infoPlistPath,
      'ITSAppUsesNonExemptEncryption',
    );
    expect(initialUsesNonExemptEncryption).toBeUndefined();

    // Apply the plugin
    await evalModsAsync(config, info);

    // Check that uses non exempt encryption was added
    const changedUsesNonExemptEncryption = await parsePlistForKey(
      infoPlistPath,
      'ITSAppUsesNonExemptEncryption',
    );
    expect(changedUsesNonExemptEncryption).toBe(true);
  });

  test('withBuildNumber', async () => {
    let { config, info } = await getTestConfig();

    // Add build number to the config
    if (!config.ios) config.ios = {};
    config.ios.buildNumber = '123';

    config = withPlugins(config, [IOSConfig.Version.withBuildNumber]);

    config = withDefaultBaseMods(config);

    const infoPlistPath = path.join(
      TEMP_DIR,
      'ios',
      info.iosProjectName,
      'Info.plist',
    );

    // Check initial state
    const initialBuildNumber = await parsePlistForKey(
      infoPlistPath,
      'CFBundleVersion',
    );
    expect(initialBuildNumber).toBe('$(CURRENT_PROJECT_VERSION)');

    // Apply the plugin
    await evalModsAsync(config, info);

    // Check that build number was updated
    const changedBuildNumber = await parsePlistForKey(
      infoPlistPath,
      'CFBundleVersion',
    );
    expect(changedBuildNumber).toBe(config.ios?.buildNumber);
  });

  test('withVersion', async () => {
    let { config, info } = await getTestConfig();

    // Add version to the config
    if (!config.ios) config.ios = {};
    config.ios.version = '2.0.0';

    config = withPlugins(config, [IOSConfig.Version.withVersion]);

    config = withDefaultBaseMods(config);

    const infoPlistPath = path.join(
      TEMP_DIR,
      'ios',
      info.iosProjectName,
      'Info.plist',
    );

    // Check initial state
    const initialVersion = await parsePlistForKey(
      infoPlistPath,
      'CFBundleShortVersionString',
    );
    expect(initialVersion).toBe('$(MARKETING_VERSION)');

    // Apply the plugin
    await evalModsAsync(config, info);

    // Check that version was updated
    const changedVersion = await parsePlistForKey(
      infoPlistPath,
      'CFBundleShortVersionString',
    );
    expect(changedVersion).toBe(config.ios?.version);
  });

  test('withGoogleServicesFile', async () => {
    let { config, info } = await getTestConfig();

    // Add Google services file to the config
    if (!config.ios) config.ios = {};
    config.ios.googleServicesFile = './GoogleService-Info.plist';

    config = withPlugins(config, [IOSConfig.Google.withGoogleServicesFile]);

    config = withDefaultBaseMods(config);

    const projectPbxprojPath = path.join(
      TEMP_DIR,
      'ios',
      `${info.iosProjectName}.xcodeproj`,
      'project.pbxproj',
    );

    // Check initial state
    const projectContent = await fs.readFile(projectPbxprojPath, 'utf8');
    expect(projectContent).not.toContain('GoogleService-Info.plist');

    // Apply the plugin
    await evalModsAsync(config, info);

    // Check that Google services file was added
    const changedProjectContent = await fs.readFile(projectPbxprojPath, 'utf8');
    expect(changedProjectContent).toContain('GoogleService-Info.plist');

    const googleServicePath = path.join(
      TEMP_DIR,
      'ios',
      info.iosProjectName,
      'GoogleService-Info.plist',
    );
    const googleServiceFileExists = await fs
      .access(googleServicePath)
      .then(() => true)
      .catch(() => false);
    expect(googleServiceFileExists).toBe(true);
  });

  test('withJsEnginePodfileProps', async () => {
    let { config, info } = await getTestConfig();

    // Add JS engine configuration to the config
    config.jsEngine = 'jsc';

    config = withPlugins(config, [
      IOSConfig.BuildProperties.withJsEnginePodfileProps,
    ]);

    config = withDefaultBaseMods(config);

    const podfilePath = path.join(TEMP_DIR, 'ios', 'Podfile');

    // @todo: check that the property is not already set in the Podfile

    // Apply the plugin
    await evalModsAsync(config, info);

    // Expect Podfile.properties.json to be created
    const podfilePropertiesPath = path.join(
      TEMP_DIR,
      'ios',
      'Podfile.properties.json',
    );

    // Expect the property to exist in Podfile.properties.json
    const podfilePropertiesContent = await fs.readFile(
      podfilePropertiesPath,
      'utf8',
    );
    const podfileProperties = JSON.parse(podfilePropertiesContent);
    expect(podfileProperties['expo.jsEngine']).toBe('jsc');

    // @todo: check that the property is actually used in the Podfile
  });

  test('withNewArchEnabledPodfileProps', async () => {
    let { config, info } = await getTestConfig();

    // Add new arch configuration to the config
    if (!config.ios) config.ios = {};
    config.ios.newArchEnabled = true;

    config = withPlugins(config, [
      IOSConfig.BuildProperties.withNewArchEnabledPodfileProps,
    ]);

    config = withDefaultBaseMods(config);

    // Apply the plugin
    await evalModsAsync(config, info);

    // Expect Podfile.properties.json to be created
    const podfilePropertiesPath = path.join(
      TEMP_DIR,
      'ios',
      'Podfile.properties.json',
    );

    // Expect the property to exist in Podfile.properties.json
    const podfilePropertiesContent = await fs.readFile(
      podfilePropertiesPath,
      'utf8',
    );
    const podfileProperties = JSON.parse(podfilePropertiesContent);
    expect(podfileProperties['newArchEnabled']).toBe('true');
  });

  test('withAssociatedDomains', async () => {
    let { config, info } = await getTestConfig();

    // Add associated domains to the config
    if (!config.ios) config.ios = {};
    config.ios.associatedDomains = ['applinks:rock-js.dev'];

    config = withPlugins(config, [
      IOSConfig.Entitlements.withAssociatedDomains,
    ]);

    config = withDefaultBaseMods(config);

    // Apply the plugin
    await evalModsAsync(config, info);

    // Check that entitlements file was created with associated domains
    const entitlementsPath = path.join(
      TEMP_DIR,
      'ios',
      info.iosProjectName,
      `${info.iosProjectName}.entitlements`,
    );
    const entitlementsContent = await parsePlistForKey(
      entitlementsPath,
      'com.apple.developer.associated-domains',
    );

    expect(entitlementsContent).toEqual(['applinks:rock-js.dev']);
  });

  test('withDeviceFamily - isTabletOnly', async () => {
    let { config, info } = await getTestConfig();

    // Add device family configuration to the config
    if (!config.ios) config.ios = {};
    config.ios.isTabletOnly = true;

    config = withPlugins(config, [IOSConfig.DeviceFamily.withDeviceFamily]);

    config = withDefaultBaseMods(config);

    const projectPbxprojPath = path.join(
      TEMP_DIR,
      'ios',
      `${info.iosProjectName}.xcodeproj`,
      'project.pbxproj',
    );

    // Check initial state
    const projectContent = await fs.readFile(projectPbxprojPath, 'utf8');
    expect(projectContent).not.toContain('TARGETED_DEVICE_FAMILY');

    // Apply the plugin
    await evalModsAsync(config, info);

    // Check that device family was updated
    const changedProjectContent = await fs.readFile(projectPbxprojPath, 'utf8');

    expect(changedProjectContent).toContain('TARGETED_DEVICE_FAMILY = "2"');
  });

  test('withDeviceFamily - supportsTablet', async () => {
    let { config, info } = await getTestConfig();

    // Add device family configuration to the config
    if (!config.ios) config.ios = {};
    config.ios.supportsTablet = true;

    config = withPlugins(config, [IOSConfig.DeviceFamily.withDeviceFamily]);

    config = withDefaultBaseMods(config);

    const projectPbxprojPath = path.join(
      TEMP_DIR,
      'ios',
      `${info.iosProjectName}.xcodeproj`,
      'project.pbxproj',
    );

    // Check initial state
    const projectContent = await fs.readFile(projectPbxprojPath, 'utf8');
    expect(projectContent).not.toContain('TARGETED_DEVICE_FAMILY');

    // Apply the plugin
    await evalModsAsync(config, info);

    // Check that device family was updated
    const changedProjectContent = await fs.readFile(projectPbxprojPath, 'utf8');

    expect(changedProjectContent).toContain('TARGETED_DEVICE_FAMILY = "1,2"');
  });

  test('withBitcode', async () => {
    let { config, info } = await getTestConfig();

    // Add bitcode configuration to the config
    if (!config.ios) config.ios = {};
    config.ios.bitcode = true;

    config = withPlugins(config, [IOSConfig.Bitcode.withBitcode]);

    config = withDefaultBaseMods(config);

    const projectPbxprojPath = path.join(
      TEMP_DIR,
      'ios',
      `${info.iosProjectName}.xcodeproj`,
      'project.pbxproj',
    );

    // Check initial state
    const projectContent = await fs.readFile(projectPbxprojPath, 'utf8');
    expect(projectContent).toContain('ENABLE_BITCODE = NO');

    // Apply the plugin
    await evalModsAsync(config, info);

    // Check that bitcode was updated
    const changedProjectContent = await fs.readFile(projectPbxprojPath, 'utf8');
    expect(changedProjectContent).toContain('ENABLE_BITCODE = YES');
  });

  test('withLocales', async () => {
    let { config, info } = await getTestConfig();

    // Add locales configuration to the config
    config.locales = {
      en: './locale/en.json',
      pl: './locale/pl.json',
    };

    config = withPlugins(config, [IOSConfig.Locales.withLocales]);

    config = withDefaultBaseMods(config);

    const supportingDirectory = path.join(
      TEMP_DIR,
      'ios',
      info.iosProjectName,
      'Supporting',
    );

    // Supporting directory should not exist
    const supportingDirectoryExists = await fs
      .access(supportingDirectory)
      .then(() => true)
      .catch(() => false);
    expect(supportingDirectoryExists).toBe(false);

    // Apply the plugin
    await evalModsAsync(config, info);

    // Supporting directory for each locale should exist
    const enDirectory = path.join(supportingDirectory, 'en.lproj');
    const plDirectory = path.join(supportingDirectory, 'pl.lproj');

    const [enDirectoryExists, plDirectoryExists] = await Promise.all([
      fs
        .access(enDirectory)
        .then(() => true)
        .catch(() => false),
      fs
        .access(plDirectory)
        .then(() => true)
        .catch(() => false),
    ]);

    expect(enDirectoryExists).toBe(true);
    expect(plDirectoryExists).toBe(true);
  });

  test('withDevelopmentTeam', async () => {
    let { config, info } = await getTestConfig();

    // Add development team configuration to the config
    if (!config.ios) config.ios = {};
    config.ios.appleTeamId = 'ABC123DEF4';

    config = withPlugins(config, [
      IOSConfig.DevelopmentTeam.withDevelopmentTeam,
    ]);

    config = withDefaultBaseMods(config);

    const projectPbxprojPath = path.join(
      TEMP_DIR,
      'ios',
      `${info.iosProjectName}.xcodeproj`,
      'project.pbxproj',
    );

    // Project should not have DEVELOPMENT_TEAM set initially
    const projectContent = await fs.readFile(projectPbxprojPath, 'utf8');
    expect(projectContent).not.toContain('DEVELOPMENT_TEAM');

    // Apply the plugin
    await evalModsAsync(config, info);

    // Check that development team was updated
    const changedProjectContent = await fs.readFile(projectPbxprojPath, 'utf8');
    expect(changedProjectContent).toContain(config.ios?.appleTeamId);
  });

  test('withPrivacyInfo', async () => {
    let { config, info } = await getTestConfig();

    // Add privacy info configuration to the config
    if (!config.ios) config.ios = {};
    config.ios.privacyManifests = {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['0A2A.1'],
        },
      ],
    };

    config = withPlugins(config, [IOSConfig.PrivacyInfo.withPrivacyInfo]);

    config = withDefaultBaseMods(config);

    // Check that 0A2A.1 is not in the PrivacyInfo.xcprivacy file
    const privacyInfoPath = path.join(
      TEMP_DIR,
      'ios',
      info.iosProjectName,
      'PrivacyInfo.xcprivacy',
    );
    const privacyInfoContent = await fs.readFile(privacyInfoPath, 'utf8');
    expect(privacyInfoContent).not.toContain('0A2A.1');

    // Apply the plugin
    await evalModsAsync(config, info);

    // Check that 0A2A.1 was added to the PrivacyInfo.xcprivacy file
    const changedPrivacyInfoContent = await fs.readFile(
      privacyInfoPath,
      'utf8',
    );
    expect(changedPrivacyInfoContent).toContain('0A2A.1');
  });
});
