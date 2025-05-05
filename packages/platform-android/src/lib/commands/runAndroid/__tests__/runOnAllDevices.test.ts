import type { AndroidProjectConfig } from '@react-native-community/cli-types';
import { spawn } from '@rnef/tools';
import type { Mock } from 'vitest';
import { vi } from 'vitest';
import { runGradle } from '../../runGradle.js';
import type { Flags } from '../runAndroid.js';

const gradleTaskOutput = `
> Task :tasks

------------------------------------------------------------
Tasks runnable from root project 'Bar'
------------------------------------------------------------

Android tasks
-------------
androidDependencies - Displays the Android dependencies of the project.
signingReport - Displays the signing info for the base and test modules
sourceSets - Prints out all the source sets defined in this project.

Build tasks
-----------
assemble - Assemble main outputs for all the variants.
assembleAndroidTest - Assembles all the Test applications.
assembleDebug - Assembles main outputs for all Debug variants.
assembleRelease - Assembles main outputs for all Release variants.
build - Assembles and tests this project.
buildDependents - Assembles and tests this project and all projects that depend on it.
buildNeeded - Assembles and tests this project and all projects it depends on.
bundle - Assemble bundles for all the variants.
bundleDebug - Assembles bundles for all Debug variants.
bundleRelease - Assembles bundles for all Release variants.


Install tasks
-------------
installDebug - Installs the Debug build.
installDebugAndroidTest - Installs the android (on device) tests for the Debug build.
installRelease - Installs the Release build.
uninstallAll - Uninstall all applications.
`;

describe('--appFolder', () => {
  const args: Flags = {
    appId: '',
    tasks: undefined,
    variant: 'debug',
    appIdSuffix: '',
    mainActivity: 'MainActivity',
    port: '8081',
    activeArchOnly: false,
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
  beforeEach(() => {
    vi.clearAllMocks();
    (spawn as Mock).mockResolvedValueOnce({ output: gradleTaskOutput });
  });

  it('uses task "install[Variant]" as default task', async () => {
    await runGradle({
      tasks: ['installDebug'],
      args: { ...args },
      androidProject,
      artifactName: 'rnef-android-debug-123456abcdef',
    });
    expect((spawn as Mock).mock.calls[0][1]).toContain('app:installDebug');
  });

  it('uses appName and default variant', async () => {
    await runGradle({
      tasks: ['installDebug'],
      args: { ...args },
      androidProject: { ...androidProject, appName: 'someApp' },
      artifactName: 'rnef-android-debug-123456abcdef',
    });

    expect((spawn as Mock).mock.calls[0][1]).toContain('someApp:installDebug');
  });

  it('uses appName and custom variant', async () => {
    await runGradle({
      tasks: ['installRelease'],
      args: { ...args },
      androidProject: { ...androidProject, appName: 'anotherApp' },
      artifactName: 'rnef-android-release-123456abcdef',
    });

    expect((spawn as Mock).mock.calls[0][1]).toContain(
      'anotherApp:installRelease'
    );
  });

  it('uses only task argument', async () => {
    await runGradle({
      tasks: ['installDebug', 'someTask'],
      args: { ...args },
      androidProject,
      artifactName: 'rnef-android-debug-123456abcdef',
    });

    expect((spawn as Mock).mock.calls[0][1]).toContain('app:someTask');
  });

  it('uses appName and custom task argument', async () => {
    await runGradle({
      tasks: ['someTask', 'installDebug'],
      args: { ...args },
      androidProject: { ...androidProject, appName: 'anotherApp' },
      artifactName: 'rnef-android-debug-123456abcdef',
    });

    expect((spawn as Mock).mock.calls[0][1]).toContain('anotherApp:someTask');
  });

  it('uses multiple tasks', async () => {
    await runGradle({
      tasks: ['clean', 'someTask'],
      args: { ...args },
      androidProject,
      artifactName: 'rnef-android-debug-123456abcdef',
    });

    expect((spawn as Mock).mock.calls[0][1]).toEqual([
      'app:clean',
      'app:someTask',
      '-x',
      'lint',
      '-PreactNativeDevServerPort=8081',
    ]);
  });
});
