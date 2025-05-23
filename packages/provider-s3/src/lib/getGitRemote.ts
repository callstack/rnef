import { cacheManager, logger, promptSelect, spawn } from '@rnef/tools';

export async function getGitRemote() {
  let gitRemote = cacheManager.get('gitRemote');
  if (gitRemote) {
    return gitRemote;
  }

  const { output: remoteOutput } = await spawn('git', ['remote'], {
    stdio: 'pipe',
  });
  const remotes = remoteOutput.split('\n').filter(Boolean);
  if (remotes.length > 1) {
    gitRemote = await promptSelect({
      message: 'Select git remote of the upstream repository:',
      options: remotes.map((remote) => ({
        value: remote,
        label: remote,
      })),
    });

    cacheManager.set('gitRemote', gitRemote);
  } else if (remotes.length === 1) {
    gitRemote = remotes[0];
  } else {
    // @todo add "learn more" link to docs when available
    logger.warn('No git remote found. Proceeding with local build.');
    return null;
  }

  return gitRemote;
}
