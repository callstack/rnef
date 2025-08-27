import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { PluginApi } from '@rock-js/config';
import type { FingerprintSources } from '@rock-js/tools';
import {
  color,
  intro,
  isInteractive,
  logger,
  nativeFingerprint,
  outro,
  RockError,
  spinner,
} from '@rock-js/tools';

type NativeFingerprintCommandOptions = {
  platform: 'ios' | 'android';
  raw?: boolean;
};

function loadEnvFiles(projectRoot: string): void {
  const envFiles = [
    '.env',
    '.env.local',
    `.env.${process.env['NODE_ENV']}`,
    `.env.${process.env['NODE_ENV']}.local`,
  ].filter(Boolean);

  for (const envFile of envFiles) {
    const envPath = path.join(projectRoot, envFile);
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const envVars = parseEnvFile(envContent);

        for (const [key, value] of Object.entries(envVars)) {
          if (process.env[key] === undefined) {
            process.env[key] = value;
          }
        }

        logger.debug(`Loaded env file: ${envFile}`);
      } catch (error) {
        logger.debug(`Failed to load env file ${envFile}:`, error);
      }
    }
  }
}

function parseEnvFile(content: string): Record<string, string> {
  const envVars: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        const cleanValue = value.replace(/^["']|["']$/g, '');
        envVars[key.trim()] = cleanValue;
      }
    }
  }

  return envVars;
}

function getEnvHash(envVars: string[]): string | null {
  const envValues: string[] = [];

  for (const envVar of envVars) {
    const value = process.env[envVar];
    if (value !== undefined) {
      envValues.push(`${envVar}=${value}`);
    }
  }

  if (envValues.length === 0) {
    return null;
  }

  return crypto
    .createHash('sha256')
    .update(envValues.sort().join('\n'))
    .digest('hex');
}

export async function nativeFingerprintCommand(
  path: string,
  fingerprintOptions: FingerprintSources & { env?: string[] },
  options: NativeFingerprintCommandOptions,
) {
  validateOptions(options);
  const platform = options.platform;
  const readablePlatformName = platform === 'ios' ? 'iOS' : 'Android';

  loadEnvFiles(path);

  const envVars = fingerprintOptions.env || [];
  const envHash = getEnvHash(envVars);

  if (options.raw || !isInteractive()) {
    const fingerprint = await nativeFingerprint(path, {
      platform,
      extraSources: fingerprintOptions.extraSources,
      ignorePaths: fingerprintOptions.ignorePaths,
    });

    let finalHash = fingerprint.hash;
    if (envHash) {
      finalHash = crypto
        .createHash('sha256')
        .update(`${fingerprint.hash}:${envHash}`)
        .digest('hex');
    }

    console.log(finalHash);

    console.error(
      JSON.stringify(
        {
          hash: finalHash,
          sources: fingerprint.sources.filter((source) => source.hash != null),
          envHash: envHash,
        },
        null,
        2,
      ),
    );
    return;
  }

  intro(`${readablePlatformName} Fingerprint`);

  const loader = spinner();
  loader.start("Calculating fingerprint for the project's native parts");

  const start = performance.now();
  const fingerprint = await nativeFingerprint(path, {
    platform,
    extraSources: fingerprintOptions.extraSources,
    ignorePaths: fingerprintOptions.ignorePaths,
  });

  let finalHash = fingerprint.hash;
  if (envHash) {
    finalHash = crypto
      .createHash('sha256')
      .update(`${fingerprint.hash}:${envHash}`)
      .digest('hex');
  }

  const duration = performance.now() - start;

  loader.stop(
    `Fingerprint calculated: ${color.bold(color.magenta(finalHash))}`,
  );

  logger.debug(
    'Sources:',
    JSON.stringify(
      fingerprint.sources.filter((source) => source.hash != null),
      null,
      2,
    ),
  );
  if (envHash) {
    logger.debug('Environment variables hash:', envHash);
  }
  logger.debug(`Duration: ${(duration / 1000).toFixed(1)}s`);

  outro('Success 🎉');
}

function validateOptions(options: NativeFingerprintCommandOptions) {
  if (!options.platform) {
    throw new RockError(
      'The --platform flag is required. Please specify either "ios" or "android".',
    );
  }
  if (options.platform !== 'ios' && options.platform !== 'android') {
    throw new RockError(
      `Unsupported platform "${options.platform}". Please specify either "ios" or "android".`,
    );
  }
}

export const fingerprintPlugin = () => (api: PluginApi) => {
  api.registerCommand({
    name: 'fingerprint',
    description: 'Calculate fingerprint for given platform',
    action: async (path, options) => {
      const fingerprintOptions = api.getFingerprintOptions();
      const dir = path || api.getProjectRoot();
      await nativeFingerprintCommand(dir, fingerprintOptions, options);
    },
    options: [
      {
        name: '-p, --platform <string>',
        description: 'Select platform, e.g. ios or android',
      },
      {
        name: '--raw',
        description: 'Output the raw fingerprint hash for piping',
      },
    ],
    args: [
      { name: '[path]', description: 'Directory to calculate fingerprint for' },
    ],
  });

  return {
    name: 'internal_fingerprint',
    description: 'Fingerprint plugin',
  };
};