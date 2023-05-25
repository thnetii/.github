/**
 * @param {{
 *  core: import('@actions/core');
 *  github: InstanceType<typeof import('@actions/github/lib/utils').GitHub>;
 *  inputs: {
 *    'remaining-threshold': string;
 *    'below-threshold-action': string;
 *  };
 * }} args
 */
module.exports = async ({ core, github, inputs }) => {
  const {
    'remaining-threshold': thresholdString,
    'below-threshold-action': belowThresholdAction,
  } = inputs;
  const threshold = parseInt(thresholdString, 10);
  const response = await github.rest.rateLimit.get();
  const {
    data: {
      resources: { core: rateLimit },
    },
  } = response;
  core.info(
    `Remaining rate-limit: ${rateLimit.remaining} / ${rateLimit.limit}`
  );
  if (rateLimit.remaining >= threshold) {
    core.info('Remaining rate-limit is above threshold.');
    return;
  }

  const belowThresholdText = 'Remaining rate-limit is below threshold.';
  if (belowThresholdAction === 'warning') {
    core.warning(belowThresholdText);
    return;
  }
  if (belowThresholdAction === 'failure') {
    core.setFailed(belowThresholdText);
    return;
  }
  if (belowThresholdAction === 'wait') {
    core.notice(belowThresholdText);
  } else {
    core.error(
      `Invalid input for 'below-threshold-action': ${belowThresholdAction}`,
      {
        title: `Invalid input for 'below-threshold-action'`,
      }
    );
  }

  const nowTime = new Date().getTime();
  const resetTime = rateLimit.reset * 1000;

  const delayMs = resetTime - nowTime;
  const delaySeconds = delayMs / 1000;
  core.info(
    `Waiting for rate-limit window reset. ${delaySeconds} second${
      delaySeconds === 1 ? 's' : ''
    }`
  );
  await new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
};
