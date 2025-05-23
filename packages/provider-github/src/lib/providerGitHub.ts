import type {
  CacheAvailabilityState,
  RemoteArtifact,
  RemoteBuildCache,
} from '@rnef/tools';
import {
  deleteGitHubArtifacts,
  fetchGitHubArtifactsByName,
} from './artifacts.js';
import { detectGitHubRepoDetails, type GitHubRepoDetails } from './config.js';
import { getGitRemote } from './getGitRemote.js';

export class GitHubBuildCache implements RemoteBuildCache {
  name = 'GitHub';
  repoDetails: GitHubRepoDetails | null = null;

  constructor(config?: { owner: string; repository: string; token: string }) {
    if (config) {
      this.repoDetails = {
        owner: config.owner,
        repository: config.repository,
        token: config.token,
      };
    }
  }

  async getAvailabilityState(): Promise<CacheAvailabilityState> {
    const gitRemote = await getGitRemote();
    if (!gitRemote) {
      return { isAvailable: false, reason: 'No git remote set.' };
    }

    return { isAvailable: true };
  }

  async getRepoDetails() {
    if (!this.repoDetails) {
      this.repoDetails = await detectGitHubRepoDetails();
    }
    return this.repoDetails;
  }

  async list({
    artifactName,
    limit,
  }: {
    artifactName?: string;
    limit?: number;
  }): Promise<RemoteArtifact[]> {
    const repoDetails = await this.getRepoDetails();
    const artifacts = await fetchGitHubArtifactsByName(
      artifactName,
      repoDetails,
      limit
    );
    return artifacts.map((artifact) => ({
      name: artifact.name,
      url: artifact.downloadUrl,
      id: String(artifact.id),
    }));
  }

  async download({
    artifactName,
  }: {
    artifactName: string;
  }): Promise<Response> {
    const repoDetails = await this.getRepoDetails();
    const artifacts = await this.list({ artifactName });
    if (artifacts.length === 0) {
      throw new Error(`No artifact found with name "${artifactName}"`);
    }
    return fetch(artifacts[0].url, {
      headers: {
        Authorization: `token ${repoDetails.token}`,
        'Accept-Encoding': 'None',
      },
    });
  }

  async delete({
    artifactName,
    limit,
    skipLatest,
  }: {
    artifactName: string;
    limit?: number;
    skipLatest?: boolean;
  }): Promise<RemoteArtifact[]> {
    const repoDetails = await this.getRepoDetails();
    const artifacts = await fetchGitHubArtifactsByName(
      artifactName,
      repoDetails,
      limit
    );
    if (artifacts.length === 0) {
      throw new Error(`No artifact found with name "${artifactName}"`);
    }
    const [, ...rest] = artifacts;
    return await deleteGitHubArtifacts(
      skipLatest ? rest : artifacts,
      repoDetails,
      artifactName
    );
  }

  async upload(): Promise<RemoteArtifact> {
    throw new Error(
      'Uploading artifacts to GitHub is not supported through GitHub API. See: https://docs.github.com/en/rest/actions/artifacts?apiVersion=2022-11-28'
    );
  }
}

export const providerGitHub =
  (options?: { owner: string; repository: string; token: string }) =>
  (): RemoteBuildCache =>
    new GitHubBuildCache(options);
