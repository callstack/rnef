import type { PathLike } from 'node:fs';
import fs from 'node:fs';
import type { AndroidProjectConfig } from '@react-native-community/cli-types';
import * as tools from '@rnef/tools';
import { spawn } from '@rnef/tools';
import type { Mock } from 'vitest';
import { test, vi } from 'vitest';
import { type Flags, runAndroid } from '../runAndroid.js';

const actualFs = await vi.importMock('node:fs');

const args: Flags = {
  tasks: undefined,
  variant: 'debug',
  activeArchOnly: true,
  extraParams: undefined,
  appId: '',
  appIdSuffix: '',
  mainActivity: undefined,
  port: '8081',
  remoteCache: false,
};
const androidProject: AndroidProjectConfig = {
  appName: 'app',
  packageName: 'com.test',
  applicationId: 'com.test',
  sourceDir: '/android',
  mainActivity: '.MainActivity',
  assets: [],
};

const OLD_ENV = process.env;
let adbDevicesCallsCount = 0;

beforeEach(() => {
  adbDevicesCallsCount = 0;
  vi.clearAllMocks();
  vi.resetModules();
  process.env = { ...OLD_ENV, ANDROID_HOME: '/mock/android/home' };
});

afterAll(() => {
  process.env = OLD_ENV;
});

const gradleTaskOutput = `
> Task :tasks

------------------------------------------------------------
Tasks runnable from root project 'com.bananas'
------------------------------------------------------------

Android tasks
-------------
androidDependencies - Displays the Android dependencies of the project.

Build tasks
-----------
assemble - Assemble main outputs for all the variants.
assembleDebug - Assembles main outputs for all Debug variants.
assembleAndroidTest - Assembles all the Test applications.
assembleRelease - Assembles main outputs for all Release variants.
bundle - Assemble bundles for all the variants.
bundleDebug - Assembles bundles for all Debug variants.
bundleRelease - Assembles bundles for all Release variants.`;

const adbDevicesNoDevicesOutput = `List of devices attached`;

const adbDevicesOneDeviceOutput = `List of devices attached
emulator-5552	device`;

const adbDevicesTwoDevicesOutput = `List of devices attached
emulator-5552	device
emulator-5554	device`;

const emulatorOutput = `INFO    | Storing crashdata in: /tmp/android-thymikee/emu-crash-34.1.20.db, detection is enabled for process: 35762
Pixel_3a_API_32_arm64-v8a
Pixel_8_Pro_API_34`;

const emulatorAvdNameOutputPixel3a = `Pixel_3a_API_32_arm64-v8a
OK`;

const emulatorAvdNameOutputPixel8 = `Pixel_8_Pro_API_34
OK`;

function mockCallGradleInstallDebug(file: string, args: string[]) {
  return file === './gradlew' && args?.[0] === 'app:installDebug';
}

function mockCallGradleInstallRelease(file: string, args: string[]) {
  return file === './gradlew' && args?.[0] === 'app:installRelease';
}

function mockCallGradleAssembleDebug(file: string, args: string[]) {
  return file === './gradlew' && args?.[0] === 'app:assembleDebug';
}

function mockCallGradleAssembleRelease(file: string, args: string[]) {
  return file === './gradlew' && args?.[0] === 'app:assembleRelease';
}

function mockCallGradleTasks(file: string, args: string[]) {
  return file === './gradlew' && args?.[0] === 'tasks';
}

function mockCallAdbDevices(file: string, args: string[]) {
  return (
    file === '/mock/android/home/platform-tools/adb' && args?.[0] === 'devices'
  );
}

function mockCallAdbBootCompleted(
  file: string,
  args: string[],
  device: string | undefined
) {
  return (
    file === '/mock/android/home/platform-tools/adb' &&
    args?.[0] === '-s' &&
    args?.[1] === (device ?? 'emulator-5552') &&
    args?.[2] === 'shell' &&
    args?.[3] === 'getprop' &&
    args?.[4] === 'sys.boot_completed'
  );
}

function mockCallEmulatorAvdName(
  file: string,
  args: string[],
  device: string | undefined
) {
  return (
    file === '/mock/android/home/platform-tools/adb' &&
    args?.[0] === '-s' &&
    args?.[1] === (device ?? 'emulator-5552') &&
    args?.[2] === 'emu' &&
    args?.[3] === 'avd' &&
    args?.[4] === 'name'
  );
}

function mockCallAdbReverse(
  file: string,
  args: string[],
  device: string | undefined
) {
  return (
    file === '/mock/android/home/platform-tools/adb' &&
    args?.[0] === '-s' &&
    args?.[1] === (device ?? 'emulator-5552') &&
    args?.[2] === 'reverse'
  );
}

function mockCallAdbGetCpu(
  file: string,
  args: string[],
  device: string | undefined
) {
  return (
    file === '/mock/android/home/platform-tools/adb' &&
    args?.[0] === '-s' &&
    args?.[1] === (device ?? 'emulator-5552') &&
    args?.[2] === 'shell' &&
    args?.[3] === 'getprop' &&
    args?.[4] === 'ro.product.cpu.abi'
  );
}

function mockCallAdbGetAvailableCpus(
  file: string,
  args: string[],
  device: string | undefined
) {
  return (
    file === '/mock/android/home/platform-tools/adb' &&
    args?.[0] === '-s' &&
    args?.[1] === (device ?? 'emulator-5552') &&
    args?.[2] === 'shell' &&
    args?.[3] === 'getprop' &&
    args?.[4] === 'ro.product.cpu.abilist'
  );
}

function mockCallAdbStart(
  file: string,
  args: string[],
  device: string | undefined
) {
  return (
    file === '/mock/android/home/platform-tools/adb' &&
    args?.[0] === '-s' &&
    args?.[1] === (device ?? 'emulator-5552') &&
    args?.[2] === 'shell' &&
    args?.[3] === 'am' &&
    args?.[4] === 'start'
  );
}

function mockCallEmulatorList(file: string, args: string[]) {
  return file === 'emulator' && args?.[0] === '-list-avds';
}

function mockCallEmulatorLaunch(file: string, args: string[]) {
  return file === 'emulator' && args?.[0] === '@Pixel_3a_API_32_arm64-v8a';
}

function spawnMockImplementation(
  file: string,
  args: string[],
  {
    adbDevicesOutput,
    device,
  }: { adbDevicesOutput?: string; device?: string } = {}
) {
  if (mockCallGradleInstallDebug(file, args)) {
    return { output: '<mock-gradle-install-debug>' };
  }
  if (mockCallGradleInstallRelease(file, args)) {
    return { output: '<mock-gradle-install-release>' };
  }
  if (mockCallGradleAssembleDebug(file, args)) {
    return { output: '<mock-gradle-assemble-debug>' };
  }
  if (mockCallGradleAssembleRelease(file, args)) {
    return { output: '<mock-gradle-assemble-release>' };
  }
  if (mockCallAdbDevices(file, args)) {
    adbDevicesCallsCount++;
    if (adbDevicesOutput) {
      return { output: adbDevicesOutput };
    }
    // Simulate devices being connected but not booted yet.
    if (adbDevicesCallsCount >= 3) {
      return { output: adbDevicesOneDeviceOutput };
    }
    return { output: adbDevicesNoDevicesOutput };
  }
  if (mockCallEmulatorAvdName(file, args, device)) {
    return { output: emulatorAvdNameOutputPixel3a };
  }
  if (mockCallAdbBootCompleted(file, args, device)) {
    return { output: '1' };
  }
  if (mockCallAdbReverse(file, args, device)) {
    return { output: '<mock-adb-reverse>' };
  }
  if (mockCallAdbGetCpu(file, args, device)) {
    return { output: 'arm64-v8a' };
  }
  if (mockCallAdbGetAvailableCpus(file, args, device)) {
    return { output: 'arm64-v8a' };
  }
  if (mockCallAdbStart(file, args, device)) {
    return { output: '<mock-adb-start>' };
  }
  if (mockCallEmulatorList(file, args)) {
    return { output: emulatorOutput };
  }
  if (mockCallEmulatorLaunch(file, args)) {
    return { nodeChildProcess: Promise.resolve({ unref: vi.fn() }) };
  }
  return { output: '...' };
}

test.each([['release'], ['debug'], ['staging']])(
  'runAndroid runs gradle build with correct configuration for --variant %s and launches on emulator-5554 when prompted with two devices available',
  async (variant) => {
    (spawn as Mock).mockImplementation((file, args) => {
      if (mockCallEmulatorAvdName(file, args, 'emulator-5554')) {
        return { output: emulatorAvdNameOutputPixel8 };
      }
      if (mockCallAdbBootCompleted(file, args, 'emulator-5554')) {
        return { output: '1' };
      }
      if (mockCallAdbReverse(file, args, 'emulator-5554')) {
        return { output: '<mock-adb-reverse>' };
      }
      if (mockCallAdbGetCpu(file, args, 'emulator-5554')) {
        return { output: 'armeabi-v7a' };
      }
      if (mockCallAdbGetAvailableCpus(file, args, 'emulator-5554')) {
        return { output: 'arm64-v8a,armeabi-v7a' };
      }
      if (mockCallAdbStart(file, args, 'emulator-5554')) {
        return { output: '<mock-adb-start>' };
      }
      if (mockCallGradleTasks(file, args)) {
        return { output: gradleTaskOutput };
      }
      return spawnMockImplementation(file, args, {
        adbDevicesOutput: adbDevicesTwoDevicesOutput,
      });
    });
    vi.mocked(tools.promptSelect).mockImplementation((opts) => {
      if (opts.message === 'Select the device / emulator you want to use') {
        return Promise.resolve({
          deviceId: 'emulator-5554',
          readableName: 'Pixel_8_Pro_API_34',
          connected: true,
          type: 'emulator',
        });
      }
      return Promise.resolve(undefined);
    });
    await runAndroid(
      { ...androidProject },
      { ...args, variant },
      '/',
      undefined,
      { extraSources: [], ignorePaths: [] }
    );

    expect(tools.outro).toBeCalledWith('Success 🎉.');
    expect(tools.logger.error).not.toBeCalled();

    // Runs installDebug with only active architecture arm64-v8a
    expect(spawn).toBeCalledWith(
      './gradlew',
      [
        variant === 'release'
          ? 'app:installRelease'
          : variant === 'staging'
          ? 'app:installStaging'
          : 'app:installDebug',
        '-x',
        'lint',
        '-PreactNativeDevServerPort=8081',
        '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a',
      ],
      { cwd: '/android' }
    );

    // launches com.test app with MainActivity on emulator-5552
    expect(spawn).toBeCalledWith(
      '/mock/android/home/platform-tools/adb',
      expect.arrayContaining([
        'emulator-5554',
        'com.test/com.test.MainActivity',
      ])
    );
  }
);

test.only('runAndroid runs gradle build with custom --appId, --appIdSuffix and --mainActivity', async () => {
  (spawn as Mock).mockImplementation((file, args) =>
    spawnMockImplementation(file, args)
  );
  const logErrorSpy = vi.spyOn(tools.logger, 'error');
  await runAndroid(
    { ...androidProject },
    {
      ...args,
      appId: 'com.custom',
      appIdSuffix: 'suffix',
      mainActivity: 'OtherActivity',
    },
    '/',
    undefined,
    { extraSources: [], ignorePaths: [] }
  );

  expect(tools.outro).toBeCalledWith('Success 🎉.');
  expect(logErrorSpy).not.toBeCalled();

  // launches com.custom.suffix app with OtherActivity on emulator-5552
  expect(spawn).toBeCalledWith(
    '/mock/android/home/platform-tools/adb',
    expect.arrayContaining([
      'emulator-5552',
      'com.custom.suffix/com.test.OtherActivity',
    ])
  );
});

test('runAndroid fails to launch an app on not-connected device when specified with --device emulator-5554', async () => {
  (spawn as Mock).mockImplementation((file, args) =>
    spawnMockImplementation(file, args)
  );
  const logWarnSpy = vi.spyOn(tools.logger, 'warn');

  await runAndroid(
    { ...androidProject },
    { ...args, device: 'emulator-5554' },
    '/',
    undefined,
    { extraSources: [], ignorePaths: [] }
  );
  expect(logWarnSpy).toBeCalledWith(
    'No devices or emulators found matching "emulator-5554". Using available one instead.'
  );
});

test.each([['release'], ['debug']])(
  `runAndroid launches an app on a selected device emulator-5554 when connected in --variant %s`,
  async (variant) => {
    (spawn as Mock).mockImplementation((file, args) => {
      if (mockCallEmulatorAvdName(file, args, 'emulator-5554')) {
        return { output: emulatorAvdNameOutputPixel8 };
      }
      if (mockCallAdbBootCompleted(file, args, 'emulator-5554')) {
        return { output: '1' };
      }
      if (mockCallAdbReverse(file, args, 'emulator-5554')) {
        return { output: '<mock-adb-reverse>' };
      }
      if (mockCallAdbGetCpu(file, args, 'emulator-5554')) {
        return { output: 'armeabi-v7a' };
      }
      if (mockCallAdbGetAvailableCpus(file, args, 'emulator-5554')) {
        return { output: 'arm64-v8a,armeabi-v7a' };
      }
      if (mockCallAdbStart(file, args, 'emulator-5554')) {
        return { output: '<mock-adb-start>' };
      }
      if (mockCallGradleTasks(file, args)) {
        return { output: gradleTaskOutput };
      }
      return spawnMockImplementation(file, args, {
        adbDevicesOutput: adbDevicesTwoDevicesOutput,
      });
    });

    vi.mocked(fs.existsSync).mockImplementation((file: PathLike) => {
      if (file === '/android/app/build/outputs/apk/debug/app-debug.apk') {
        return true;
      }
      if (file === '/android/app/build/outputs/apk/release/app-release.apk') {
        return true;
      }
      return (actualFs as typeof fs).existsSync(file);
    });

    vi.mocked(tools.promptSelect).mockImplementation((opts) => {
      if (opts.message === 'Select the device / emulator you want to use') {
        return Promise.resolve({
          deviceId: 'emulator-5554',
          readableName: 'Pixel_8_Pro_API_34',
          connected: true,
          type: 'emulator',
        });
      }
      if (opts.message === 'Select assemble task you want to perform') {
        return Promise.resolve(
          variant === 'release' ? 'assembleRelease' : 'assembleDebug'
        );
      }
      return Promise.resolve(undefined);
    });

    await runAndroid(
      { ...androidProject },
      { ...args, device: 'emulator-5554', variant },
      '/',
      undefined,
      { extraSources: [], ignorePaths: [] }
    );

    // we don't want to run installDebug when a device is selected, because gradle will install the app on all connected devices
    expect(spawn).not.toBeCalledWith(
      './gradlew',
      expect.arrayContaining([
        variant === 'release' ? 'app:installRelease' : 'app:installDebug',
      ])
    );

    // Runs assemble debug task with active architectures arm64-v8a, armeabi-v7a
    expect(spawn).toBeCalledWith(
      './gradlew',
      [
        variant === 'release' ? 'app:assembleRelease' : 'app:assembleDebug',
        '-x',
        'lint',
        '-PreactNativeDevServerPort=8081',
        '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a',
      ],
      { cwd: '/android' }
    );

    // launches com.test app with MainActivity on emulator-5554
    expect(spawn).toBeCalledWith(
      '/mock/android/home/platform-tools/adb',
      expect.arrayContaining([
        'emulator-5554',
        'com.test/com.test.MainActivity',
      ])
    );
  }
);

test('runAndroid launches an app on all connected devices', async () => {
  (spawn as Mock).mockImplementation((file, args) => {
    if (mockCallAdbBootCompleted(file, args, 'emulator-5554')) {
      return { output: '1' };
    }
    if (mockCallAdbReverse(file, args, 'emulator-5554')) {
      return { output: '<mock-adb-reverse>' };
    }
    if (mockCallAdbGetCpu(file, args, 'emulator-5554')) {
      return { output: 'armeabi-v7a' };
    }
    if (mockCallAdbGetAvailableCpus(file, args, 'emulator-5554')) {
      return { output: 'arm64-v8a,armeabi-v7a' };
    }
    if (mockCallAdbStart(file, args, 'emulator-5554')) {
      return { output: '<mock-adb-start>' };
    }
    return spawnMockImplementation(file, args, {
      adbDevicesOutput: adbDevicesTwoDevicesOutput,
    });
  });

  await runAndroid({ ...androidProject }, { ...args }, '/', undefined, {
    extraSources: [],
    ignorePaths: [],
  });

  // Runs assemble debug task with active architectures arm64-v8a, armeabi-v7a
  expect(spawn).toBeCalledWith(
    './gradlew',
    [
      'app:installDebug',
      '-x',
      'lint',
      '-PreactNativeDevServerPort=8081',
      '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a',
    ],
    { cwd: '/android' }
  );

  // launches com.test app with MainActivity on emulator-5552
  expect(spawn).toBeCalledWith(
    '/mock/android/home/platform-tools/adb',
    expect.arrayContaining(['emulator-5552', 'com.test/com.test.MainActivity'])
  );

  // launches com.test app with MainActivity on emulator-5554
  expect(spawn).toBeCalledWith(
    '/mock/android/home/platform-tools/adb',
    expect.arrayContaining(['emulator-5554', 'com.test/com.test.MainActivity'])
  );
});

test('runAndroid skips building when --binary-path is passed', async () => {
  (spawn as Mock).mockImplementation((file, args) => {
    if (mockCallAdbBootCompleted(file, args, 'emulator-5554')) {
      return { output: '1' };
    }
    if (mockCallAdbReverse(file, args, 'emulator-5554')) {
      return { output: '<mock-adb-reverse>' };
    }
    if (mockCallAdbGetCpu(file, args, 'emulator-5554')) {
      return { output: 'armeabi-v7a' };
    }
    if (mockCallAdbGetAvailableCpus(file, args, 'emulator-5554')) {
      return { output: 'arm64-v8a,armeabi-v7a' };
    }
    if (mockCallAdbStart(file, args, 'emulator-5554')) {
      return { output: '<mock-adb-start>' };
    }
    return spawnMockImplementation(file, args, {
      adbDevicesOutput: adbDevicesTwoDevicesOutput,
    });
  });

  vi.mocked(fs.existsSync).mockImplementation((file: PathLike) => {
    // binaryPath is normalized to root + binaryPath
    if (file === '/root/android/app/build/outputs/apk/debug/app-debug.apk') {
      return true;
    }
    return (actualFs as typeof fs).existsSync(file);
  });

  await runAndroid(
    { ...androidProject },
    {
      ...args,
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
    },
    '/root',
    undefined,
    { extraSources: [], ignorePaths: [] }
  );

  // Skips gradle
  expect(spawn).not.toBeCalledWith('./gradlew');

  // launches com.test app with MainActivity on emulator-5554
  expect(spawn).toBeCalledWith(
    '/mock/android/home/platform-tools/adb',
    expect.arrayContaining(['emulator-5552', 'com.test/com.test.MainActivity'])
  );

  // launches com.test app with MainActivity on emulator-5554
  expect(spawn).toBeCalledWith(
    '/mock/android/home/platform-tools/adb',
    expect.arrayContaining(['emulator-5554', 'com.test/com.test.MainActivity'])
  );
});
