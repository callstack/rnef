import {
  cacheManager,
  color,
  logger,
  type RemoteArtifact,
  RnefError,
} from '@rnef/tools';
import { type GitHubRepoDetails } from './config.js';

const PAGE_SIZE = 100; // Maximum allowed by GitHub API

type GitHubArtifact = {
  id: number;
  name: string;
  expiresAt: string | null;
  sizeInBytes: number;
  downloadUrl: string;
};

type GitHubArtifactResponse = {
  artifacts: {
    id: number;
    name: string;
    size_in_bytes: number;
    expires_at: string | null;
    archive_download_url: string;
    expired: boolean;
    workflow_run: {
      id: number;
    };
  }[];
};

export async function fetchGitHubArtifactsByName(
  name: string | undefined,
  repoDetails: GitHubRepoDetails,
  limit?: number
): Promise<GitHubArtifact[] | []> {
  let page = 1;
  const result: GitHubArtifact[] = [];
  const owner = repoDetails.owner;
  const repo = repoDetails.repository;
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts?per_page=${
    limit ?? PAGE_SIZE
  }&page=${page}${name ? `&name=${name}` : ''}`;

  try {
    while (true) {
      let data: GitHubArtifactResponse;
      try {
        const response = await fetch(url, {
          headers: { Authorization: `token ${repoDetails.token}` },
        });
        if (!response.ok) {
          throw new Error(
            `HTTP error: ${response.status} ${response.statusText}`
          );
        }
        data = await response.json();
      } catch (error) {
        throw new Error(
          `Error fetching artifacts from ${color.underline(url)}: ${error}`
        );
      }

      const artifacts = data.artifacts
        .filter((artifact) => !artifact.expired && artifact.workflow_run?.id)
        .map((artifact) => ({
          id: artifact.id,
          name: artifact.name,
          sizeInBytes: artifact.size_in_bytes,
          expiresAt: artifact.expires_at,
          downloadUrl: artifact.archive_download_url,
        }));

      result.push(...artifacts);

      if (artifacts.length < PAGE_SIZE) {
        break;
      }

      page += 1;
    }
  } catch (error) {
    if ((error as { message: string }).message.includes('401 Unauthorized')) {
      cacheManager.remove('githubToken');
      throw new RnefError(
        `Failed to fetch GitHub artifacts due to invalid or expired GitHub Personal Access Token provided.
Update the token under "${color.bold(
          'remoteCacheProvider'
        )}" key in ${color.cyan('rnef.config.mjs')} config file.

📘 Read more about generating a new token: ${color.cyan(
          'https://rnef.dev/docs/remote-cache/github-actions/configuration#generate-github-personal-access-token-for-downloading-cached-builds'
        )}`
      );
    }
    if ((error as { message: string }).message.includes('404 Not Found')) {
      throw new RnefError(
        `Failed to fetch GitHub artifacts due to "404 Not Found" error. This can happen for the following reasons:
- permission mismatch between your GitHub Personal Access Token and the repository
- you're blocked by the owner of the repository
- repository address is incorrect

Make sure the repository information and token under "${color.bold(
          'remoteCacheProvider'
        )}" key in ${color.cyan('rnef.config.mjs')} config file is valid.

📘 Read more about generating a new token: ${color.cyan(
          'https://rnef.dev/docs/remote-cache/github-actions/configuration#generate-github-personal-access-token-for-downloading-cached-builds'
        )}`
      );
    }
    throw new RnefError(`Failed to fetch GitHub artifacts`, { cause: error });
  }

  result.sort((a, b) => {
    const expiresA = a.expiresAt ?? '0000-00-00';
    const expiresB = b.expiresAt ?? '0000-00-00';
    // Sort in descending order
    return expiresB.localeCompare(expiresA);
  });
  return result;
}

export async function deleteGitHubArtifacts(
  artifacts: GitHubArtifact[],
  repoDetails: GitHubRepoDetails,
  artifactName: string
): Promise<RemoteArtifact[]> {
  const deletedArtifacts: RemoteArtifact[] = [];
  try {
    const owner = repoDetails.owner;
    const repo = repoDetails.repository;

    // Delete all matching artifacts
    for (const artifact of artifacts) {
      const artifactId = artifact.id;
      const url = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${repoDetails.token}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (!response.ok) {
        logger.warn(
          `Failed to delete artifact ID ${artifactId}: ${response.status} ${response.statusText}`
        );
        continue;
      }

      deletedArtifacts.push({ name: artifact.name, url: artifact.downloadUrl });
    }
    return deletedArtifacts;
  } catch (error) {
    throw new RnefError(`Failed to delete artifacts named "${artifactName}"`, {
      cause: error,
    });
  }
}
