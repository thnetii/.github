/* eslint-disable no-console */
const { execSync } = require('node:child_process');

/** @param {string} actionPath */
module.exports = async (actionPath) => {
  const command = `npm install --prefix "${actionPath}" --omit=dev`;
  console.log(`[command]${command}`);
  execSync(command, {
    cwd: actionPath,
    stdio: [process.stdin, process.stdout, process.stderr],
  });
};
