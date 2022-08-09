const { execSync } = require('child_process');
const path = require('path');

/** @param {string} actionPath */
module.exports = (actionPath) => {
  const repoRootPath = path.resolve(path.join(__dirname, '..', '..'));
  const workspacePath = path.relative(repoRootPath, actionPath);
  execSync(`npm ci --workspace ${workspacePath} --omit=dev`, {
    cwd: repoRootPath,
    stdio: [process.stdin, process.stdout, process.stderr],
  });
};
