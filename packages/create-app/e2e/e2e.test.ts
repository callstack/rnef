import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import {
  execAsync,
  getRandomString,
  getTempDirectory,
} from '@callstack/rnef-test-helpers';

const CREATE_APP_PATH = path.resolve(__dirname, '../dist/src/bin.js');
const TEMPLATES_DIR = path.resolve(__dirname, '../../../templates');
const TEMP_DIR = getTempDirectory('e2e-deploys');

beforeEach(() => {
  mkdirSync(TEMP_DIR, { recursive: true });
});

describe('create-app command', { timeout: 30_000 }, () => {
  it(
    'should create a new project from default template',
    { timeout: 30_000 },
    async () => {
      const projectName = `test-default-template-${getRandomString(6)}`;
      const projectPath = path.resolve(TEMP_DIR, projectName);

      if (existsSync(projectPath)) {
        rmSync(projectPath, { recursive: true, force: true });
      }

      await execAsync(
        `node ${CREATE_APP_PATH} ${projectName} --template=default --platform=ios --platform=android --plugin=metro`,
        { cwd: TEMP_DIR }
      );

      const packageJsonPath = path.join(projectPath, 'package.json');
      expect(existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      expect(packageJson.name).toBe(projectName);
      expect(packageJson.version).toBe('1.0.0');
      expect(packageJson.private).toBe(true);
      expect(packageJson.description).not.toBeDefined();
      expect(packageJson.author).not.toBeDefined();
      expect(packageJson.license).not.toBeDefined();
      expect(packageJson.repository).not.toBeDefined();
      expect(packageJson.bugs).not.toBeDefined();
      expect(packageJson.homepage).not.toBeDefined();
      expect(packageJson.keywords).not.toBeDefined();
      expect(packageJson.packageManager).not.toBeDefined();
    }
  );

  it.skip('should create a new project from npm template', async () => {
    const projectName = `test-npm-template-${getRandomString(6)}`;
    const projectPath = path.resolve(TEMP_DIR, projectName);

    if (existsSync(projectPath)) {
      rmSync(projectPath, { recursive: true, force: true });
    }

    await execAsync(
      `node ${CREATE_APP_PATH} ${projectName} --template=@callstack/repack --platform=ios --platform=android --plugin=metro`,
      { cwd: TEMP_DIR }
    );

    const packageJsonPath = path.join(projectPath, 'package.json');
    expect(existsSync(packageJsonPath)).toBe(true);

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    expect(packageJson.name).toBe(projectName);
    expect(packageJson.version).toBe('1.0.0');
    expect(packageJson.private).toBe(true);
    expect(packageJson.description).not.toBeDefined();
    expect(packageJson.author).not.toBeDefined();
    expect(packageJson.license).not.toBeDefined();
    expect(packageJson.repository).not.toBeDefined();
    expect(packageJson.bugs).not.toBeDefined();
    expect(packageJson.homepage).not.toBeDefined();
    expect(packageJson.keywords).not.toBeDefined();
    expect(packageJson.packageManager).not.toBeDefined();
  });

  it(
    'should create a new project from local directory template',
    { timeout: 30_000 },
    async () => {
      const projectName = `test-local-dir-template-${getRandomString(6)}`;
      const projectPath = path.resolve(TEMP_DIR, projectName);

      if (existsSync(projectPath)) {
        rmSync(projectPath, { recursive: true, force: true });
      }

      const templatePath = `${TEMPLATES_DIR}/rnef-template-default`;
      await execAsync(
        `node ${CREATE_APP_PATH} ${projectName} --template="${templatePath}" --platform=ios --platform=android --plugin=metro`,
        { cwd: TEMP_DIR }
      );

      const packageJsonPath = path.join(projectPath, 'package.json');
      expect(existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      expect(packageJson.name).toBe(projectName);
      expect(packageJson.version).toBe('1.0.0');
      expect(packageJson.private).toBe(true);
      expect(packageJson.description).not.toBeDefined();
      expect(packageJson.author).not.toBeDefined();
      expect(packageJson.license).not.toBeDefined();
      expect(packageJson.repository).not.toBeDefined();
      expect(packageJson.bugs).not.toBeDefined();
      expect(packageJson.homepage).not.toBeDefined();
      expect(packageJson.keywords).not.toBeDefined();
      expect(packageJson.packageManager).not.toBeDefined();
    }
  );
});
