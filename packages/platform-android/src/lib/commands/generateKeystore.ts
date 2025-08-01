import path from 'node:path';
import type { AndroidProjectConfig } from '@react-native-community/cli-types';
import type { PluginApi } from '@rnef/config';
import type { SubprocessError } from '@rnef/tools';
import {
  color,
  colorLink,
  intro,
  logger,
  outro,
  promptGroup,
  promptText,
  RnefError,
  spawn,
} from '@rnef/tools';
import { getValidProjectConfig } from './getValidProjectConfig.js';

export function registerCreateKeystoreCommand(
  api: PluginApi,
  pluginConfig: AndroidProjectConfig | undefined,
  commandName: string
) {
  api.registerCommand({
    name: commandName,
    description: 'Creates a keystore file for signing Android release builds.',
    action: async (args) => {
      const androidConfig = getValidProjectConfig(
        api.getProjectRoot(),
        pluginConfig
      );
      await generateKeystore(androidConfig, args);
    },
    options: generateKeystoreOptions,
  });
}

export async function generateKeystore(
  androidProject: AndroidProjectConfig,
  args: Flags
) {
  intro('Generate a keystore file for signing Android release builds.');
  await runKeytool(androidProject, args);
  outro('Success 🎉.');
}

type Flags = {
  name?: string;
  alias?: string;
};

async function runKeytool(androidProject: AndroidProjectConfig, args: Flags) {
  const { name, alias } = await prompts({ name: args.name, alias: args.alias });
  const keystoreOutputPath = path.join(
    androidProject.sourceDir,
    androidProject.appName,
    `${name}.keystore`
  );
  logger.info(
    `Running "keytool" command. You'll be further prompted for password and extra information.`
  );
  logger.log('');
  try {
    // keytool -genkey -v -keystore release.keystore -alias rnef-alias -keyalg RSA -keysize 2048 -validity 10000
    await spawn(
      'keytool',
      [
        '-genkey',
        '-v',
        '-keystore',
        keystoreOutputPath,
        '-alias',
        alias,
        '-keyalg',
        'RSA',
        '-keysize',
        '2048',
        '-validity',
        '10000',
      ],
      { stdio: 'inherit' }
    );

    logger.success(`Keystore generated at: ${colorLink(keystoreOutputPath)}`);
    logger.warn(
      `Edit the ${colorLink('~/.gradle/gradle.properties')} or ${colorLink(
        './android/gradle.properties'
      )} file, and add the following (replace ***** with the correct keystore password):`
    );
    // use console log to make it easy to copy-paste without messing with "|" characters injected by `logger.log`
    console.log(
      color.yellow(`
   RNEF_UPLOAD_STORE_FILE=release.keystore
   RNEF_UPLOAD_KEY_ALIAS=rnef-alias
   RNEF_UPLOAD_STORE_PASSWORD=*****
   RNEF_UPLOAD_KEY_PASSWORD=*****`)
    );
  } catch (error) {
    throw new RnefError(
      `Failed to generate keystore. Please try manually by following instructions at: ${colorLink(
        'https://reactnative.dev/docs/signed-apk-android'
      )}`,
      { cause: (error as SubprocessError).stderr }
    );
  }
}

async function prompts({ name, alias }: Flags) {
  return promptGroup({
    name: () =>
      name
        ? Promise.resolve(name)
        : promptText({
            message: 'Provide keystore name',
            initialValue: 'release',
          }),
    alias: () =>
      alias
        ? Promise.resolve(alias)
        : promptText({
            message: 'Provide keystore alias',
            initialValue: 'rnef-alias',
          }),
  });
}

export const generateKeystoreOptions = [
  {
    name: '--name <string>',
    description: 'Name of the keystore file.',
  },
  {
    name: '--alias <string>',
    description: 'Alias for the key.',
  },
];
