import { expect, test } from 'vitest';
import type {
  CacheAvailabilityState,
  RemoteBuildCache,
} from '../build-cache/common.js';

const uploadMock = vi.fn();

class DummyRemoteCacheProvider implements RemoteBuildCache {
  name = 'dummy';
  constructor(options?: { name: string }) {
    if (options) {
      this.name = options.name;
    }
  }

  async getAvailabilityState(): Promise<CacheAvailabilityState> {
    return { isAvailable: true };
  }

  async list({ artifactName }: { artifactName: string }) {
    return [{ name: artifactName, url: '/path/to/dummy' }];
  }
  async download({ artifactName }: { artifactName: string }) {
    const resBody = new TextEncoder().encode(artifactName);
    return new Response(resBody);
  }
  async delete({ artifactName }: { artifactName: string }) {
    if (artifactName === 'dummy') {
      return [{ name: artifactName, url: '/path/to/dummy' }];
    }
    return [];
  }
  async upload({ artifactName }: { artifactName: string }) {
    uploadMock(artifactName);
    return { name: artifactName, url: '/path/to/dummy' };
  }
}

test('dummy remote cache provider lists artifacts', async () => {
  const pluginDummyRemoteCacheProvider = (options?: { name: string }) => () =>
    new DummyRemoteCacheProvider(options);
  const remoteBuildCache = pluginDummyRemoteCacheProvider()();
  const artifacts = await remoteBuildCache.list({
    artifactName: 'rnef-android-debug-7af554b93cd696ca95308fdebe3a4484001bb7b4',
  });
  expect(artifacts).toEqual([
    {
      name: 'rnef-android-debug-7af554b93cd696ca95308fdebe3a4484001bb7b4',
      url: '/path/to/dummy',
    },
  ]);
});

test('dummy remote cache provider downloads artifacts', async () => {
  const pluginDummyRemoteCacheProvider = (options?: { name: string }) => () =>
    new DummyRemoteCacheProvider(options);
  const remoteBuildCache = pluginDummyRemoteCacheProvider()();
  const artifact = await remoteBuildCache?.download({
    artifactName: 'rnef-android-debug-7af554b93cd696ca95308fdebe3a4484001bb7b4',
  });
  const response = await artifact?.text();
  expect(response).toEqual(
    'rnef-android-debug-7af554b93cd696ca95308fdebe3a4484001bb7b4'
  );
});

test('dummy remote cache provider deletes artifacts', async () => {
  const pluginDummyRemoteCacheProvider = (options?: { name: string }) => () =>
    new DummyRemoteCacheProvider(options);
  const remoteBuildCache = pluginDummyRemoteCacheProvider()();
  const result = await remoteBuildCache?.delete({ artifactName: 'dummy' });
  expect(result).toEqual([
    {
      name: 'dummy',
      url: '/path/to/dummy',
    },
  ]);
  const result2 = await remoteBuildCache?.delete({ artifactName: 'dummy2' });
  expect(result2).toEqual([]);
});

test('dummy remote cache provider uploads artifacts', async () => {
  const pluginDummyRemoteCacheProvider = (options?: { name: string }) => () =>
    new DummyRemoteCacheProvider(options);
  const remoteBuildCache = pluginDummyRemoteCacheProvider()();
  await remoteBuildCache?.upload({ artifactName: 'dummy' });
  expect(uploadMock).toHaveBeenCalledWith('dummy');
});
