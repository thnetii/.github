/**
 * @param {{
 *  core: import('@actions/core');
 *  github: InstanceType<typeof import('@actions/github/lib/utils').GitHub>;
 *  inputs: {};
 * }} args
 */
module.exports = async ({ core, github }) => {
  const response = await github.rest.rateLimit.get();
  const {
    data: {
      resources: { core: rateLimit },
    },
  } = response;
  core.info(
    `Remaining rate-limit: ${rateLimit.remaining} / ${rateLimit.limit}`,
  );
  core.setOutput('remaining', rateLimit.remaining);
  core.setOutput('limit', rateLimit.limit);
  const reset = new Date(rateLimit.reset * 1000).toISOString();
  core.info(`Rate-limit window resets at: ${reset}`);
  core.setOutput('reset', reset);
  core.info(`Rate-limit usage: ${rateLimit.used}`);
  core.setOutput('used', rateLimit.used);
};
