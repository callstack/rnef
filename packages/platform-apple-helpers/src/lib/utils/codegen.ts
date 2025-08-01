import type { SubprocessError } from '@rnef/tools';
import { spawn } from '@rnef/tools';
import { RnefError } from '@rnef/tools';
import fs from 'fs';
import path from 'path';
import type { ApplePlatform } from '../types/index.js';

interface CodegenOptions {
  projectRoot: string;
  platformName: ApplePlatform;
  reactNativePath: string;
  sourceDir: string;
}

async function runCodegen(options: CodegenOptions) {
  const buildDir = path.join(options.sourceDir, 'build');
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true });
  }

  const codegenScript = path.join(
    options.reactNativePath,
    'scripts/generate-codegen-artifacts.js'
  );

  try {
    await spawn('node', [
      codegenScript,
      '-p',
      options.projectRoot,
      '-o',
      options.sourceDir,
      '-t',
      options.platformName === 'tvos' ? 'ios' : options.platformName,
    ]);
  } catch (error) {
    throw new RnefError('Failed to run React Native codegen script', {
      cause: (error as SubprocessError).output,
    });
  }
}

export default runCodegen;
