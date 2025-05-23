import { expect, type Mock, test, vi } from 'vitest';
import { providerS3 } from '../lib/providerS3.js';

beforeEach(() => {
  global.fetch = vi.fn();
});

const ARTIFACTS = [
  {
    workflow_run: { id: 2 },
    id: 123,
    name: 'rnef-android-debug-1234567890',
    archive_download_url:
      'https://api.github.com/repos/callstack/rnef/actions/artifacts/123',
    size_in_bytes: 10000,
    expires_at: '2025-05-20T12:00:00Z',
  },
  {
    workflow_run: { id: 3 },
    id: 124,
    name: 'rnef-android-debug-1234567890',
    archive_download_url:
      'https://api.github.com/repos/callstack/rnef/actions/artifacts/124',
    size_in_bytes: 10000,
    expires_at: '2025-05-20T12:00:00Z',
  },
];

test('providerS3 implements list method returning an array of artifacts', async () => {
  const limit = 1;
  (global.fetch as Mock).mockResolvedValue(
    new Response(JSON.stringify({ artifacts: ARTIFACTS.slice(0, limit) }))
  );
  const cacheProvider = providerS3({
    owner: 'callstack',
    repository: 'rnef',
    token: 'TEST_TOKEN',
  })();
  const result = await cacheProvider.list({
    artifactName: 'rnef-android-debug-1234567890',
    limit,
  });
  expect(fetch).toHaveBeenCalledWith(
    `https://api.github.com/repos/callstack/rnef/actions/artifacts?per_page=${limit}&page=1&name=rnef-android-debug-1234567890`,
    {
      headers: {
        Authorization: 'token TEST_TOKEN',
      },
    }
  );
  expect(result).toEqual([
    {
      id: '123',
      name: 'rnef-android-debug-1234567890',
      url: 'https://api.github.com/repos/callstack/rnef/actions/artifacts/123',
    },
  ]);
});

test('providerS3 implements download method returning a stream with artifact zip', async () => {
  const limit = 1;
  const bytes = new Uint8Array(100);
  const downloadResponse = new Response(bytes);
  global.fetch = vi.fn((url) => {
    if (
      url ===
      'https://api.github.com/repos/callstack/rnef/actions/artifacts?per_page=100&page=1&name=rnef-android-debug-1234567890'
    ) {
      return Promise.resolve(
        new Response(JSON.stringify({ artifacts: ARTIFACTS.slice(0, limit) }))
      );
    }
    if (
      url ===
      'https://api.github.com/repos/callstack/rnef/actions/artifacts/123'
    ) {
      return Promise.resolve(downloadResponse);
    }
    return Promise.reject(new Error('Unexpected URL'));
  });
  const cacheProvider = providerS3({
    owner: 'callstack',
    repository: 'rnef',
    token: 'TEST_TOKEN',
  })();
  const response = await cacheProvider.download({
    artifactName: 'rnef-android-debug-1234567890',
  });
  const result = await response.arrayBuffer();
  expect(result).toBeInstanceOf(ArrayBuffer);
  expect(result.byteLength).toBe(100);
  expect(new Uint8Array(result)).toEqual(new Uint8Array(100));
});

test('providerS3 implements delete method', async () => {
  const limit = undefined;
  global.fetch = vi.fn((url, options) => {
    if (
      url ===
      'https://api.github.com/repos/callstack/rnef/actions/artifacts?per_page=100&page=1&name=rnef-android-debug-1234567890'
    ) {
      return Promise.resolve(
        new Response(JSON.stringify({ artifacts: ARTIFACTS }))
      );
    }
    if (
      url ===
        'https://api.github.com/repos/callstack/rnef/actions/artifacts/123' &&
      options.method === 'DELETE'
    ) {
      return Promise.resolve(new Response());
    }
    if (
      url ===
        'https://api.github.com/repos/callstack/rnef/actions/artifacts/124' &&
      options.method === 'DELETE'
    ) {
      return Promise.resolve(new Response());
    }
    return Promise.reject(new Error('Unexpected URL'));
  });
  const cacheProvider = providerS3({
    owner: 'callstack',
    repository: 'rnef',
    token: 'TEST_TOKEN',
  })();
  const response = await cacheProvider.delete({
    artifactName: 'rnef-android-debug-1234567890',
    limit,
  });
  expect(response).toEqual([
    {
      name: 'rnef-android-debug-1234567890',
      url: 'https://api.github.com/repos/callstack/rnef/actions/artifacts/123',
    },
    {
      name: 'rnef-android-debug-1234567890',
      url: 'https://api.github.com/repos/callstack/rnef/actions/artifacts/124',
    },
  ]);
});

test('providerS3 does not implement upload method', async () => {
  const cacheProvider = providerS3({
    owner: 'callstack',
    repository: 'rnef',
    token: 'TEST_TOKEN',
  })();
  await expect(
    cacheProvider.upload({ artifactName: 'rnef-android-debug-1234567890' })
  ).rejects.toThrow(
    'Uploading artifacts to GitHub is not supported through GitHub API. See: https://docs.github.com/en/rest/actions/artifacts?apiVersion=2022-11-28'
  );
});
