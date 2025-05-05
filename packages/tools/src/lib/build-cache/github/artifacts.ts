import * as fs from 'node:fs';
import AdmZip from 'adm-zip';
import cacheManager from '../../cacheManager.js';
import { color } from '../../color.js';
import logger from '../../logger.js';
import type { spinner } from '../../prompts.js';
import { getGitHubToken, type GitHubRepoDetails } from './config.js';

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
  repoDetails: GitHubRepoDetails | null,
  limit?: number
): Promise<GitHubArtifact[] | []> {
  if (!repoDetails) {
    return [];
  }
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
          headers: { Authorization: `token ${getGitHubToken()}` },
        });
        if (!response.ok) {
          throw new Error(
            `HTTP error: ${response.status} ${response.statusText}`
          );
        }
        data = await response.json();
      } catch (error) {
        throw new Error(`Error fetching artifacts: ${error}`);
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
      logger.warn(
        `Failed to fetch GitHub artifacts due to invalid or expired GitHub Personal Access Token provided.
Please generate a new one at: ${color.cyan(
          'https://github.com/settings/tokens'
        )}
Include "repo", "workflow", and "read:org" permissions.
Next time you run the command, you will be prompted to enter the new token.`
      );
      cacheManager.remove('githubToken');
    } else {
      logger.warn(
        'Failed to fetch GitHub artifacts: ',
        (error as { message: string }).message
      );
    }
  }

  result.sort((a, b) => {
    const expiresA = a.expiresAt ?? '0000-00-00';
    const expiresB = b.expiresAt ?? '0000-00-00';
    // Sort in descending order
    return expiresB.localeCompare(expiresA);
  });
  return result;
}

export async function downloadGitHubArtifact(
  downloadUrl: string,
  targetPath: string,
  name: string,
  loader?: ReturnType<typeof spinner>
): Promise<void> {
  try {
    fs.mkdirSync(targetPath, { recursive: true });

    const response = await fetch(downloadUrl, {
      headers: {
        Authorization: `token ${getGitHubToken()}`,
        'Accept-Encoding': 'None',
      },
    });

    if (!response.ok || !response.body) {
      throw new Error(`Failed to download artifact: ${response.statusText}`);
    }
    let responseData = response;
    const contentLength = response.headers.get('content-length');

    if (contentLength) {
      const totalBytes = parseInt(contentLength, 10);
      const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
      let downloadedBytes = 0;

      const reader = response.body.getReader();
      const stream = new ReadableStream({
        async start(controller) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            downloadedBytes += value.length;
            const progress = ((downloadedBytes / totalBytes) * 100).toFixed(0);
            loader?.message(
              `Downloading cached build from ${name} (${progress}% of ${totalMB} MB)`
            );
            controller.enqueue(value);
          }
          controller.close();
        },
      });
      responseData = new Response(stream);
    }

    const zipPath = targetPath + '.zip';
    const buffer = await responseData.arrayBuffer();
    fs.writeFileSync(zipPath, new Uint8Array(buffer));

    unzipFile(zipPath, targetPath);
    fs.unlinkSync(zipPath);
  } catch (error) {
    console.log('Error: ', error);
    throw new Error(`Failed to download cached build ${error}`);
  }
}

function unzipFile(zipPath: string, targetPath: string): void {
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(targetPath, true);
}
