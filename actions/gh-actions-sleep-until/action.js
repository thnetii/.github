/**
 * @param {{
 *  core: import('@actions/core'),
 *  inputs: {
 *    datetime: string,
 *  },
 * }} args
 */
module.exports = async ({ core, inputs: { datetime: dateString } }) => {
  const nowTime = new Date().getTime();
  const waitDate = new Date(dateString);
  const waitTime = waitDate.getTime();
  core.info(`Waiting until ${waitDate.toISOString()}`);
  const waitMs = waitTime - nowTime;
  await new Promise((resolve) => {
    setTimeout(resolve, waitMs);
  });
};
