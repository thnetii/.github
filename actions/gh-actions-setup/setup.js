/* eslint-disable no-console */
const { execSync } = require('node:child_process');
const path = require('node:path');

/** @param {string} actionPath */
module.exports = async (actionPath) => {
  const repoRootPath = path.resolve(path.join(__dirname, '..', '..'));
  const workspacePath = path.relative(repoRootPath, actionPath);
  const gitCommand = `git submodule update --init`;
  console.log(`[command]${gitCommand}`);
  execSync(gitCommand, {
    cwd: repoRootPath,
    stdio: [process.stdin, process.stdout, process.stderr],
  });
  const npmCommand = `npm install --workspace "${workspacePath}" --no-audit --no-fund --install-links`;
  console.log(`[command]${npmCommand}`);
  execSync(npmCommand, {
    cwd: repoRootPath,
    stdio: [process.stdin, process.stdout, process.stderr],
  });
};
