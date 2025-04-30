/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from 'node:path';
import type { PluginApi } from '@rnef/config';
import { findDevServerPort, intro } from '@rnef/tools';
import type { StartCommandArgs } from './runServer.js';
import runServer from './runServer.js';

export async function startDevServer({
  root,
  args,
  reactNativeVersion,
  reactNativePath,
  platforms,
}: {
  root: string;
  args: StartCommandArgs;
  reactNativeVersion: string;
  reactNativePath: string;
  platforms: Record<string, object>;
}) {
  const { port, startDevServer } = await findDevServerPort(
    args.port ?? 8081,
    root
  );

  if (!startDevServer) {
    return;
  }

  return runServer(
    { root, reactNativeVersion, reactNativePath, platforms },
    { ...args, port }
  );
}

export const registerStartCommand = (api: PluginApi) => {
  api.registerCommand({
    name: 'start',
    action: async (args: StartCommandArgs) => {
      intro('Starting Metro dev server');
      const root = api.getProjectRoot();
      const reactNativeVersion = api.getReactNativeVersion();
      const reactNativePath = api.getReactNativePath();
      const platforms = api.getPlatforms();
      await startDevServer({
        root,
        args,
        reactNativeVersion,
        reactNativePath,
        platforms,
      });
    },
    description: 'Start the Metro development server.',
    options: [
      {
        name: '--port <number>',
        description: 'Port to run the server on',
        parse: Number,
      },
      {
        name: '--host <string>',
        description: 'Host to run the server on',
        default: '',
      },
      {
        name: '--project-root, --projectRoot <path>',
        description: 'Path to a custom project root',
        parse: (val: string): string => path.resolve(val),
      },
      {
        name: '--watch-folders, --watchFolders <list>',
        description:
          'Specify any additional folders to be added to the watch list',
        parse: (val: string): Array<string> =>
          val.split(',').map((folder: string) => path.resolve(folder)),
      },
      {
        name: '--asset-plugins, --assetPlugins <list>',
        description:
          'Specify any additional asset plugins to be used by the packager by full filepath',
        parse: (val: string): Array<string> => val.split(','),
      },
      {
        name: '--source-exts, --sourceExts <list>',
        description:
          'Specify any additional source extensions to be used by the packager',
        parse: (val: string): Array<string> => val.split(','),
      },
      {
        name: '--max-workers <number>',
        description:
          'Specifies the maximum number of workers the worker-pool ' +
          'will spawn for transforming files. This defaults to the number of the ' +
          'cores available on your machine.',
        parse: (workers: string): number => Number(workers),
      },
      {
        name: '--transformer <string>',
        description: 'Specify a custom transformer to be used',
      },
      {
        name: '--reset-cache, --resetCache',
        description: 'Removes cached files',
      },
      {
        name: '--custom-log-reporter-path, --customLogReporterPath <string>',
        description:
          'Path to a JavaScript file that exports a log reporter as a replacement for TerminalReporter',
      },
      {
        name: '--https',
        description: 'Enables https connections to the server',
      },
      {
        name: '--key <path>',
        description: 'Path to custom SSL key',
      },
      {
        name: '--cert <path>',
        description: 'Path to custom SSL cert',
      },
      {
        name: '--config <string>',
        description: 'Path to the CLI configuration file',
        parse: (val: string): string => path.resolve(val),
      },
      {
        name: '--no-interactive',
        description: 'Disables interactive mode',
      },
      {
        name: '--client-logs',
        description:
          '[Deprecated] Enable plain text JavaScript log streaming for all ' +
          'connected apps. This feature is deprecated and will be removed in ' +
          'future.',
        default: false,
      },
    ],
  });
};
