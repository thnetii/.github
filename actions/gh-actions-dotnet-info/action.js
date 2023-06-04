/**
 * @param {{
 *  exec: import('@actions/exec'),
 * }} args
 */
module.exports = async ({ exec }) => {
  await exec.exec('dotnet', ['--info']);
};
