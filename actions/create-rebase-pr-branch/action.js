/**
 * @param {Parameters<typeof module.exports>[0]} args
 */
const getScriptHelper = ({ github, context }) => ({
  /** @param {string} ref */
  async existsRef(ref) {
    try {
      await github.rest.git.getRef({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref,
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
 *  branchName: string,
 *  upstreamSha: string,
 * }} args
 */
module.exports = async (args) => {
  const {
    branchName,
    context: { sha: ctxSha },
    upstreamSha,
    exec: { exec },
  } = args;
  const scriptHelper = getScriptHelper(args);
  const branchExists = await scriptHelper.existsRef(`heads/${branchName}`);
  if (branchExists) {
    await exec('git', ['fetch', 'origin', `${branchName}:${branchName}`]);
    await exec('git', [
      'rebase',
      '--strategy-option=ours',
      upstreamSha || ctxSha,
      branchName,
    ]);
  } else {
    await exec('git', ['checkout', '-B', branchName, upstreamSha || ctxSha]);
  }
};
