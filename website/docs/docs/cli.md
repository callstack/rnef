# `rnef` CLI

The RNEF CLI is a command-line tool that helps you develop, build, and run React Native applications.

Basic usage:

```shell title="Terminal"
npx rnef [command] [options]
```

![](/cli.png)

## Global Options

The following options are available for all commands:

| Options             | Description                     |
| ------------------- | ------------------------------- |
| `-h` or `--help`    | Shows all available options     |
| `-V` or `--version` | Outputs the RNEF version number |
| `--verbose`         | Sets verbose logging            |

## Available Commands

RNEF CLI uses a modular design where available commands depend on your configuration. The following commands are available by default for all configurations (these are internal commands that you typically won't need to run):

| Command       | Description                                     |
| :------------ | :---------------------------------------------- |
| `config`      | Outputs autolinking config (from Community CLI) |
| `fingerprint` | Calculates fingerprint for project or platform  |
| `help`        | Displays help menu for a command                |

Additional commands for development, building, and running apps are provided by specialized plugins.

### Bundler Plugins

Bundler plugins are configured through the [`bundler`](/docs/configuration/index#bundler) property in your configuration. Available bundlers include:

- `@rnef/plugin-metro` – Metro bundler plugin with the following commands:

  | Command  | Description                   |
  | :------- | :---------------------------- |
  | `start`  | Starts Metro dev server       |
  | `bundle` | Bundles JavaScript with Metro |

- `@rnef/plugin-repack` – Re.Pack bundler plugin with the following commands:

  | Command  | Description                     |
  | :------- | :------------------------------ |
  | `start`  | Starts Re.Pack dev server       |
  | `bundle` | Bundles JavaScript with Re.Pack |

### Platform Plugins

Platform plugins are configured through the [`platform`](/docs/configuration/index#platforms) property in your configuration. Available platforms include:

- `@rnef/platform-android` – Android platform plugin with the following commands:

  | Command         | Description                                                     |
  | :-------------- | :-------------------------------------------------------------- |
  | `run:android`   | Runs Android app on emulator or device                          |
  | `build:android` | Builds Android app for generic emulator, device or distribution |
  | `sign:android`  | Signs Android app with keystore                                 |

- `@rnef/platform-ios` – iOS platform plugin with the following commands:

  | Command     | Description                                                  |
  | :---------- | :----------------------------------------------------------- |
  | `build:ios` | Builds iOS app for generic simulator, device or distribution |
  | `run:ios`   | Runs iOS app on simulator or device                          |
  | `sign:ios`  | Signs iOS app with certificate and provisioning profile      |

## Command Options

### `rnef start` Options

The `start` command launches a development server (either Re.Pack or Metro, depending on your bundler plugin) that connects to your apps through port 8081 by default. It provides features like Hot Module Reloading (HMR) and error reporting.

| Option                                            | Description                                                                                 |
| :------------------------------------------------ | :------------------------------------------------------------------------------------------ |
| `--port <number>`                                 | Port to run the server on (default: 8081)                                                   |
| `--host <string>`                                 | Host to run the server on (default: "")                                                     |
| `--project-root <path>`, `--projectRoot <path>`   | Path to a custom project root                                                               |
| `--watch-folders <list>`, `--watchFolders <list>` | Specify any additional folders to be added to the watch list                                |
| `--asset-plugins <list>`, `--assetPlugins <list>` | Specify any additional asset plugins to be used by the packager by full filepath            |
| `--source-exts <list>`,`--sourceExts <list>`      | Specify any additional source extensions to be used by the packager                         |
| `--max-workers <number>`                          | Specifies the maximum number of workers the worker-pool will spawn for transforming files   |
| `--transformer <string>`                          | Specify a custom transformer to be used                                                     |
| `--reset-cache`, `--resetCache`                   | Removes cached files                                                                        |
| `--custom-log-reporter-path <string>`             | Path to a JavaScript file that exports a log reporter as a replacement for TerminalReporter |
| `--https`                                         | Enables https connections to the server                                                     |
| `--key <path>`                                    | Path to custom SSL key                                                                      |
| `--cert <path>`                                   | Path to custom SSL cert                                                                     |
| `--config <string>`                               | Path to the CLI configuration file                                                          |
| `--no-interactive`                                | Disables interactive mode                                                                   |
| `--client-logs`                                   | [Deprecated] Enable plain text JavaScript log streaming for all connected apps              |

### `rnef bundle` Options

The `bundle` command creates an optimized JavaScript bundle for your application, optionally using Hermes bytecode.

| Option                                  | Description                                                                                          |
| :-------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| `--entry-file <path>`                   | Path to the root JS file, either absolute or relative to JS root                                     |
| `--platform <string>`                   | Either "ios" or "android" (default: "ios")                                                           |
| `--transformer <string>`                | Specify a custom transformer to be used                                                              |
| `--dev [boolean]`                       | If false, warnings are disabled and the bundle is minified (default: true)                           |
| `--minify [boolean]`                    | Allows overriding whether bundle is minified. Defaults to false if dev is true, true if dev is false |
| `--bundle-output <string>`              | File name where to store the resulting bundle, ex. /tmp/groups.bundle                                |
| `--bundle-encoding <string>`            | Encoding the bundle should be written in (default: "utf8")                                           |
| `--max-workers <number>`                | Specifies the maximum number of workers the worker-pool will spawn for transforming files            |
| `--sourcemap-output <string>`           | File name where to store the sourcemap file for resulting bundle, ex. /tmp/groups.map                |
| `--sourcemap-sources-root <string>`     | Path to make sourcemap's sources entries relative to, ex. /root/dir                                  |
| `--sourcemap-use-absolute-path`         | Report SourceMapURL using its full path (default: false)                                             |
| `--assets-dest <string>`                | Directory name where to store assets referenced in the bundle                                        |
| `--unstable-transform-profile <string>` | Experimental, transform JS for a specific JS engine (default: "default")                             |
| `--asset-catalog-dest [string]`         | Path where to create an iOS Asset Catalog for images                                                 |
| `--reset-cache`                         | Removes cached files (default: false)                                                                |
| `--read-global-cache`                   | Try to fetch transformed JS code from the global cache, if configured (default: false)               |
| `--config <string>`                     | Path to the CLI configuration file                                                                   |
| `--resolver-option <string...>`         | Custom resolver options of the form key=value. URL-encoded. May be specified multiple times          |
| `--config-cmd [string]`                 | [Internal] A hack for Xcode build script pointing to wrong bundle command                            |
| `--hermes`                              | Passes the output JS bundle to Hermes compiler and outputs a bytecode file                           |

### `rnef build:ios` Options

The `build:ios` command builds your iOS app for simulators, devices, or distribution, producing either an APP directory (for simulators) or an IPA file (for devices and distribution).

| Option                            | Description                                                                                                                                                                                                                                                  |
| :-------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--configuration <string>`        | Xcode scheme configuration (case sensitive)                                                                                                                                                                                                                  |
| `--scheme <string>`               | Xcode scheme to use                                                                                                                                                                                                                                          |
| `--target <string>`               | Xcode target to use                                                                                                                                                                                                                                          |
| `--extra-params <string>`         | Custom xcodebuild parameters                                                                                                                                                                                                                                 |
| `--export-extra-params <string>`  | Custom xcodebuild export archive parameters                                                                                                                                                                                                                  |
| `--export-options-plist <string>` | Export options file for archiving (default: ExportOptions.plist)                                                                                                                                                                                             |
| `--build-folder <string>`         | Location for iOS build artifacts                                                                                                                                                                                                                             |
| `--destination <strings...>`      | Define destination(s) for the build. You can pass multiple destinations as separate values or repeated use of the flag. Values can be either: "simulator", "device" or destinations supported by "xcodebuild -destination" flag, e.g. "generic/platform=iOS" |
| `--archive`                       | Create Xcode archive (IPA)                                                                                                                                                                                                                                   |
| `--no-install-pods`               | Skip CocoaPods installation                                                                                                                                                                                                                                  |
| `--no-new-arch`                   | Build in legacy async architecture                                                                                                                                                                                                                           |

### `rnef run:ios` Options

The `run:ios` command runs your iOS app on a simulator or device. It follows this build strategy:

1. Use the provided binary if specified with `--binary-path`
1. Build locally if `--local` flag is set
1. Otherwise, try to use a cached build from cache (in `.rnef` folder)

The build cache is populated either by a local build or when downloaded frome remote storage with [`remoteCacheProvider`](./configuration.md#remote-cache-configuration).

`run:ios` extends the functionality of `build:ios` with additional runtime options.

| Option                   | Description                               |
| :----------------------- | :---------------------------------------- |
| `--port <number>`        | Bundler port (default: 8081)              |
| `--binary-path <string>` | Path to pre-built .app binary             |
| `--device <string>`      | Device/simulator to use (by name or UDID) |
| `--catalyst`             | Run on Mac Catalyst                       |
| `--local`                | Force local build with xcodebuild         |

### `rnef sign:ios` Options

The `sign:ios` command signs your iOS app with certificates and provisioning profiles, producing a signed IPA file ready for distribution.

| Option                | Description                                |
| :-------------------- | :----------------------------------------- |
| `--identity <string>` | Certificate Identity name for code signing |
| `--output <string>`   | Path to output IPA file                    |
| `--build-jsbundle`    | Build JS bundle before signing             |
| `--jsbundle <string>` | Path to JS bundle to apply before signing  |
| `--no-hermes`         | Don't use Hermes for JS bundle             |

### `rnef build:android` Options

The `build:android` command builds your Android app for emulators, devices, or distribution, producing either APK or AAB files. It follows this build strategy:

1. Use the provided binary if specified with `--binary-path`
1. Build locally if `--local` flag is set
1. Otherwise, try to use a cached build from cache (in `.rnef` folder)

The build cache is populated either by a local build or when downloaded frome remote storage with [`remoteCacheProvider`](./configuration.md#remote-cache-configuration).

| Option                   | Description                             |
| :----------------------- | :-------------------------------------- |
| `--variant <string>`     | Build variant (debug/release)           |
| `--aab`                  | Build Android App Bundle instead of APK |
| `--active-arch-only`     | Build only for active architecture      |
| `--tasks <array>`        | Custom Gradle tasks                     |
| `--extra-params <array>` | Extra parameters for Gradle             |

### `rnef run:android` Options

The `run:android` command runs your Android app on an emulator or device. It extends the functionality of `build:android` with additional runtime options.

Same as for `build:android` and:

| Option                     | Description                           |
| :------------------------- | :------------------------------------ |
| `--app-id <string>`        | Application ID                        |
| `--app-id-suffix <string>` | Application ID suffix                 |
| `--binary-path <string>`   | Path to pre-built APK                 |
| `--local`                  | Force local build with Gradle wrapper |

### `rnef sign:android` Options

The `sign:android` command signs your Android app with a keystore, producing a signed APK file ready for distribution.

| Option                         | Description                               |
| :----------------------------- | :---------------------------------------- |
| `--keystore <string>`          | Path to keystore file                     |
| `--keystore-password <string>` | Password for keystore file                |
| `--output <string>`            | Path to output APK file                   |
| `--build-jsbundle`             | Build JS bundle before signing            |
| `--jsbundle <string>`          | Path to JS bundle to apply before signing |
| `--no-hermes`                  | Don't use Hermes for JS bundle            |
