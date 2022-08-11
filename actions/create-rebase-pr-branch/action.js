/** @param {string} repository */
function getRepoRef(repository) {
  const slashIdx = (repository || '').indexOf('/');
  if (slashIdx < 0) return { owner: undefined, repo: undefined };
  return {
    owner: repository.slice(0, slashIdx),
    repo: repository.slice(slashIdx + 1),
  };
}

/**
 * @param {Parameters<typeof module.exports>[0]} args
 */
const getScriptHelper = ({ github, context, inputs }) => ({
  async existsRef() {
    const { owner = context.repo.owner, repo = context.repo.repo } = getRepoRef(
      inputs.repository
    );
    try {
      await github.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${inputs['branch-name']}`,
      });
    } catch (err) {
      const reqError =
        /** @type { import('@octokit/request-error').RequestError } */ (err);
      const { name, status } = reqError;
      if (name !== 'HttpError' || status !== 404) {
        throw err;
      }
      return false;
    }
    return true;
  },
});

/**
 * @param {{
 *  github: InstanceType<typeof import('@actions/github/lib/utils').GitHub>,
 *  context: import('@actions/github/lib/context').Context,
 *  core: import('@actions/core'),
 *  exec: import('@actions/exec'),
 *  inputs: {
 *    'branch-name': string,
 *    'repository': string,
 *    'upstream-sha': string,
 *    'working-directory': string,
 *  },
 * }} args
 */
module.exports = async (args) => {
  const {
    exec: { exec },
    inputs: { 'branch-name': branchName, 'working-directory': workDir },
  } = args;
  const scriptHelper = getScriptHelper(args);
  const branchExists = await scriptHelper.existsRef();
  /** @type {import('@actions/exec').ExecOptions} */
  const execOpts = {
    cwd: workDir,
  };
  if (branchExists) {
    await exec(
      'git',
      ['checkout', '-B', 'tmp/create-rebase-branch-upstream'],
      execOpts
    );
    await exec(
      'git',
      ['fetch', 'origin', `${branchName}:${branchName}`],
      execOpts
    );
    await exec(
      'git',
      [
        'rebase',
        '--strategy-option=theirs',
        'tmp/create-rebase-branch-upstream',
        branchName,
      ],
      execOpts
    );
  } else {
    await exec('git', ['checkout', '-B', branchName], execOpts);
  }
};
