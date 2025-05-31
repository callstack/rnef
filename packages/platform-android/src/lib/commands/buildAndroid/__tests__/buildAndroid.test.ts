import type { PathLike } from 'node:fs';
import fs from 'node:fs';
import type { AndroidProjectConfig } from '@react-native-community/cli-types';
import * as tools from '@rnef/tools';
import { color, spawn } from '@rnef/tools';
import type { Mock } from 'vitest';
import { test, vi } from 'vitest';
import { buildAndroid, type BuildFlags } from '../buildAndroid.js';

const actualFs = await vi.importMock('node:fs');

const args: BuildFlags = {
  tasks: undefined,
  variant: 'debug',
  activeArchOnly: false,
  extraParams: undefined,
};
const androidProject: AndroidProjectConfig = {
  appName: 'app',
  packageName: 'com.test',
  applicationId: 'com.test',
  sourceDir: '/android',
  mainActivity: '.MainActivity',
  assets: [],
};

const fingerprintOptions = {
  extraSources: [],
  ignorePaths: [],
};

const spinnerMock = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  message: vi.fn(),
}));

vi.spyOn(tools, 'spinner').mockImplementation(() => spinnerMock);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

function mockCallAdbGetCpu(file: string, args: string[]) {
  return (
    file === '/mock/android/home/platform-tools/adb' &&
    args?.[0] === 'shell' &&
    args?.[1] === 'getprop' &&
    args?.[2] === 'ro.product.cpu.abi'
  );
}

function spawnMockImplementation(file: string, args: string[]) {
  if (mockCallAdbGetCpu(file, args)) {
    return { output: 'arm64-v8a' };
  }
  return { output: '...' };
}

test('buildAndroid runs gradle build with correct configuration for debug and outputs build path', async () => {
  (spawn as Mock).mockImplementation((file, args) =>
    spawnMockImplementation(file, args)
  );
  vi.mocked(fs.existsSync).mockImplementation((file: PathLike) => {
    if (file === '/android/app/build/outputs/bundle/debug/app-debug.aab') {
      return true;
    }
    return (actualFs as typeof fs).existsSync(file);
  });

  await buildAndroid(
    androidProject,
    { ...args, aab: true },
    '/root',
    fingerprintOptions
  );

  expect(spawn).toBeCalledWith('./gradlew', ['app:bundleDebug', '-x', 'lint'], {
    cwd: '/android',
  });
  expect(spinnerMock.stop).toBeCalledWith(
    `Build available at: ${color.cyan(
      '/android/app/build/outputs/bundle/debug/app-debug.aab'
    )}`
  );
});

test('buildAndroid fails gracefully when gradle errors', async () => {
  vi.mocked(spawn).mockRejectedValueOnce({ stderr: 'gradle error' });

  await expect(
    buildAndroid(androidProject, args, '/root', fingerprintOptions)
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[RnefError: Failed to build the app. See the error above for details from Gradle.]`
  );

  expect(spawn).toBeCalledWith(
    './gradlew',
    ['app:assembleDebug', '-x', 'lint'],
    { cwd: '/android' }
  );
});
