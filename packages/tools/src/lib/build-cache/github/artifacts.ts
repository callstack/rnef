import * as fs from 'node:fs';
import AdmZip from 'adm-zip';
import logger from '../../logger.js';
import { type GitHubRepoDetails } from './config.js';

const PAGE_SIZE = 100; // Maximum allowed by GitHub API
const GITHUB_TOKEN = process.env['GITHUB_TOKEN'];

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
  name: string,
  repoDetails: GitHubRepoDetails | null
): Promise<GitHubArtifact[] | []> {
  if (!repoDetails) {
    return [];
  }
  let page = 1;
  const result: GitHubArtifact[] = [];
  const owner = repoDetails.owner;
  const repo = repoDetails.repository;
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts?per_page=${PAGE_SIZE}&page=${page}`;

  try {
    while (true) {
      let data: GitHubArtifactResponse;
      try {
        const response = await fetch(url, {
          headers: { Authorization: `token ${GITHUB_TOKEN}` },
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
        .filter(
          (artifact) =>
            !artifact.expired &&
            artifact.workflow_run?.id &&
            artifact.name === name
        )
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
        `Failed to fetch GitHub artifacts due to invalid GITHUB_TOKEN provided. 
You may be using GITHUB_TOKEN configured in your shell config file, such as ~/.zshrc.
Run "echo $GITHUB_TOKEN" to see the value.
Please generate a new token with access to this project and try again.`
      );
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
  targetPath: string
): Promise<void> {
  try {
    fs.mkdirSync(targetPath, {
      recursive: true,
    });

    const response = await fetch(downloadUrl, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download artifact: ${response.statusText}`);
    }

    const zipPath = targetPath + '.zip';
    const buffer = await response.arrayBuffer();
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
