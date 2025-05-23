import {
  cacheManager,
  color,
  logger,
  promptPassword,
  RnefError,
  spawn,
} from '@rnef/tools';
import * as r from 'ts-regex-builder';
import { getGitRemote } from './getGitRemote.js';

const GITHUB_REPO_REGEX = r.buildRegExp([
  r.startOfString,
  r.choiceOf('git@', 'https://'),
  r.oneOrMore(/[^:/]/),
  r.anyOf(':/'),
  r.capture(r.oneOrMore(/[^/]/)), // organization
  '/',
  r.capture(r.oneOrMore(r.any, { greedy: false })), // repository
  r.optional('.git'),
  r.endOfString,
]);

export function getGitHubToken(): string | undefined {
  return cacheManager.get('githubToken');
}

export async function promptForGitHubToken() {
  const githubToken = (await promptPassword({
    message: 'Paste your GitHub Personal Access Token',
    validate: (value) =>
      value.length === 0 ? 'Value is required.' : undefined,
  })) as string;
  cacheManager.set('githubToken', githubToken);
  return githubToken;
}

export type GitHubRepoDetails = {
  owner: string;
  repository: string;
  token: string;
};

export async function detectGitHubRepoDetails(): Promise<GitHubRepoDetails> {
  const gitRemote = await getGitRemote();
  try {
    const { output: url } = await spawn(
      'git',
      ['config', '--get', `remote.${gitRemote}.url`],
      { stdio: 'pipe' }
    );

    const match = url.match(GITHUB_REPO_REGEX);
    if (!match) {
      throw new RnefError(
        `The remote URL "${url}" doesn't look like a GitHub repo.`
      );
    }
    let token = getGitHubToken();
    if (!token) {
      logger.warn(
        `No GitHub Personal Access Token found necessary to download cached builds.
Please generate one at: ${color.cyan('https://github.com/settings/tokens')}
Include "repo", "workflow", and "read:org" permissions.`
      );
      token = await promptForGitHubToken();
    }

    return {
      owner: match[1],
      repository: match[2],
      token,
    };
  } catch (error) {
    throw new RnefError('Unable to detect GitHub repository details.', {
      cause: error,
    });
  }
}
