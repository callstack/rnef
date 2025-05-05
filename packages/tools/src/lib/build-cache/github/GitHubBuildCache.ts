import fs from 'node:fs';
import path from 'node:path';
import * as tar from 'tar';
import { color } from '../../color.js';
import { getGitRemote } from '../../git.js';
import logger from '../../logger.js';
import type { spinner } from '../../prompts.js';
import type {
  LocalArtifact,
  RemoteArtifact,
  RemoteBuildCache,
} from '../common.js';
import { getLocalArtifactPath } from '../common.js';
import {
  downloadGitHubArtifact,
  fetchGitHubArtifactsByName,
} from './artifacts.js';
import type { GitHubRepoDetails } from './config.js';
import {
  detectGitHubRepoDetails,
  getGitHubToken,
  promptForGitHubToken,
} from './config.js';

export class GitHubBuildCache implements RemoteBuildCache {
  name = 'GitHub';
  repoDetails: GitHubRepoDetails | null = null;

  async detectRepoDetails() {
    const gitRemote = await getGitRemote();
    this.repoDetails = gitRemote
      ? await detectGitHubRepoDetails(gitRemote)
      : null;
    if (!this.repoDetails) {
      return null;
    }
    if (!getGitHubToken()) {
      logger.warn(
        `No GitHub Personal Access Token found necessary to download cached builds.
Please generate one at: ${color.cyan('https://github.com/settings/tokens')}
Include "repo", "workflow", and "read:org" permissions.`
      );
      await promptForGitHubToken();
    }
    return this.repoDetails;
  }

  async list({
    artifactName,
    limit,
  }: {
    artifactName?: string;
    limit?: number;
  }): Promise<RemoteArtifact[] | null> {
    const repoDetails = await this.detectRepoDetails();
    if (!getGitHubToken()) {
      logger.warn(`No GitHub Personal Access Token found.`);
      return null;
    }

    if (!repoDetails) {
      return null;
    }

    const artifacts = await fetchGitHubArtifactsByName(
      artifactName,
      repoDetails,
      limit
    );
    if (artifacts.length === 0) {
      return null;
    }

    return artifacts.map((artifact) => ({
      name: artifact.name,
      url: artifact.downloadUrl,
      id: String(artifact.id),
    }));
  }

  async download({
    artifact,
    loader,
  }: {
    artifact: RemoteArtifact;
    loader?: ReturnType<typeof spinner>;
  }): Promise<LocalArtifact> {
    const artifactPath = getLocalArtifactPath(artifact.name);
    await downloadGitHubArtifact(artifact.url, artifactPath, this.name, loader);
    await extractArtifactTarballIfNeeded(artifactPath);
    return {
      name: artifact.name,
      path: artifactPath,
    };
  }

  async delete({
    artifactName,
    loader,
  }: {
    artifactName: string;
    loader?: ReturnType<typeof spinner>;
  }): Promise<boolean> {
    const repoDetails = await this.detectRepoDetails();
    if (!getGitHubToken()) {
      logger.warn(`No GitHub Personal Access Token found.`);
      return false;
    }

    if (!repoDetails) {
      return false;
    }

    const artifacts = await fetchGitHubArtifactsByName(
      artifactName,
      repoDetails
    );

    if (artifacts.length === 0) {
      loader?.stop(`No artifact found with name "${artifactName}" to delete.`);
      return false;
    }

    loader?.start(
      `Found ${artifacts.length} artifacts named "${artifactName}". Deleting...`
    );

    try {
      const owner = repoDetails.owner;
      const repo = repoDetails.repository;

      // Delete all matching artifacts
      let deletedCount = 0;
      for (const artifact of artifacts) {
        const artifactId = artifact.id;
        const url = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}`;

        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${getGitHubToken()}`,
            Accept: 'application/vnd.github+json',
          },
        });

        if (!response.ok) {
          logger.warn(
            `Failed to delete artifact ID ${artifactId}: ${response.status} ${response.statusText}`
          );
          continue;
        }

        deletedCount++;
      }

      if (deletedCount < artifacts.length) {
        loader?.stop(
          `Partially succeeded: deleted ${deletedCount}/${artifacts.length} artifacts named "${artifactName}".`
        );
        return true;
      } else {
        loader?.stop(
          `Successfully deleted all ${deletedCount} artifacts named "${artifactName}".`
        );
        return true;
      }
    } catch (error) {
      loader?.stop(
        `Failed to delete artifacts named "${artifactName}": ${error}`
      );
      return false;
    }
  }

  async upload() {
    logger.warn('Uploading artifacts to GitHub is not supported.');
    return null;
  }
}

async function extractArtifactTarballIfNeeded(artifactPath: string) {
  const tarPath = path.join(artifactPath, 'app.tar.gz');

  // If the tarball is not found, it means the artifact is already unpacked.
  if (!fs.existsSync(tarPath)) {
    return;
  }

  // iOS simulator build artifact (*.app directory) is packed in .tar.gz file to
  // preserve execute file permission.
  // See: https://github.com/actions/upload-artifact?tab=readme-ov-file#permission-loss
  await tar.extract({
    file: tarPath,
    cwd: artifactPath,
    gzip: true,
  });
  fs.unlinkSync(tarPath);
}
