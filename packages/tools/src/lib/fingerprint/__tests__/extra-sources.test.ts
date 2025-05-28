import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { processExtraSources } from '../fingerprint/extra-sources.js';

describe('processExtraSources', () => {
  const mockProjectRoot = '/mock/project/root';

  beforeEach(() => {
    vi.spyOn(fs, 'existsSync').mockImplementation(() => true);
    vi.spyOn(fs, 'statSync').mockImplementation(
      () =>
        ({
          isDirectory: () => false,
        } as any)
    );
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => 'mock content');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should process a single file', async () => {
    const result = processExtraSources(['file.txt'], mockProjectRoot);

    expect(result).toEqual([
      {
        type: 'file',
        filePath: path.join(mockProjectRoot, 'file.txt'),
        reasons: ['custom-user-config'],
      },
    ]);
  });

  it('should process a directory', async () => {
    vi.spyOn(fs, 'statSync').mockImplementation(
      () =>
        ({
          isDirectory: () => true,
        } as any)
    );

    const result = processExtraSources(['dir'], mockProjectRoot);

    expect(result).toEqual([
      {
        type: 'dir',
        filePath: path.join(mockProjectRoot, 'dir'),
        reasons: ['custom-user-config'],
      },
    ]);
  });

  it('should handle non-existent paths', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation(() => false);

    const result = processExtraSources(['non-existent.txt'], mockProjectRoot);

    expect(result).toEqual([]);
  });

  it('should process multiple sources of different types', async () => {
    const statSyncMock = vi.spyOn(fs, 'statSync');
    statSyncMock
      .mockImplementationOnce(() => ({ isDirectory: () => false } as any))
      .mockImplementationOnce(() => ({ isDirectory: () => true } as any));

    const result = processExtraSources(['file.txt', 'dir'], mockProjectRoot);

    expect(result).toEqual([
      {
        type: 'file',
        filePath: path.join(mockProjectRoot, 'file.txt'),
        reasons: ['custom-user-config'],
      },
      {
        type: 'dir',
        filePath: path.join(mockProjectRoot, 'dir'),
        reasons: ['custom-user-config'],
      },
    ]);
  });

  it('should handle absolute paths', async () => {
    const absolutePath = '/absolute/path/file.txt';

    const result = processExtraSources([absolutePath], mockProjectRoot);

    expect(result).toEqual([
      {
        type: 'file',
        filePath: absolutePath,
        reasons: ['custom-user-config'],
      },
    ]);
  });
  it('should process glob patterns', async () => {
    const fixturesDir = path.join(__dirname, '__fixtures__', 'glob-test');
    const result = processExtraSources(['**/*.txt'], fixturesDir);

    expect(result).toEqual([
      {
        type: 'file',
        filePath: path.join(fixturesDir, 'test1.txt'),
        reasons: ['custom-user-config'],
      },
      {
        type: 'file',
        filePath: path.join(fixturesDir, 'test2.txt'),
        reasons: ['custom-user-config'],
      },
      {
        type: 'file',
        filePath: path.join(fixturesDir, 'subdir', 'test3.txt'),
        reasons: ['custom-user-config'],
      },
    ]);
  });

  it('should handle glob patterns with ignore paths', async () => {
    const fixturesDir = path.join(__dirname, '__fixtures__', 'glob-test');
    const result = processExtraSources(['**/*.txt'], fixturesDir, [
      'test2.txt',
    ]);

    expect(result).toEqual([
      {
        type: 'file',
        filePath: path.join(fixturesDir, 'test1.txt'),
        reasons: ['custom-user-config'],
      },
      {
        type: 'file',
        filePath: path.join(fixturesDir, 'subdir', 'test3.txt'),
        reasons: ['custom-user-config'],
      },
    ]);
  });

  it('should handle glob patterns with ignore paths and ignore subdirectories', async () => {
    const fixturesDir = path.join(__dirname, '__fixtures__', 'glob-test');
    const result = processExtraSources(['**/*.txt'], fixturesDir, [
      'subdir/**',
    ]);

    expect(result).toEqual([
      {
        type: 'file',
        filePath: path.join(fixturesDir, 'test1.txt'),
        reasons: ['custom-user-config'],
      },
      {
        type: 'file',
        filePath: path.join(fixturesDir, 'test2.txt'),
        reasons: ['custom-user-config'],
      },
    ]);
  });

  it('should continue processing even if some sources fail', async () => {
    const existsSyncMock = vi.spyOn(fs, 'existsSync');
    existsSyncMock
      .mockImplementationOnce(() => true) // for file.txt
      .mockImplementationOnce(() => false); // for non-existent.txt

    const result = processExtraSources(
      ['file.txt', 'non-existent.txt'],
      mockProjectRoot
    );

    expect(result).toEqual([
      {
        type: 'file',
        filePath: path.join(mockProjectRoot, 'file.txt'),
        reasons: ['custom-user-config'],
      },
    ]);
  });
});
