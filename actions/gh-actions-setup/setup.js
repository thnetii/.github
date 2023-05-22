/* eslint-disable no-console */
const { createRequire } = require('node:module');
const { execSync } = require('node:child_process');
const path = require('node:path');

/** @param {string} actionPath */
module.exports = async (actionPath) => {
  const actionRequire = createRequire(actionPath);
  const actionPackageJsonPath = path.join(actionPath, 'package.json');
  const { name } = actionRequire(actionPackageJsonPath);
  const repoRootPath = path.resolve(path.join(__dirname, '..', '..'));
  console.log(`Executing npm to install dependencies.`);
  execSync(`npm install --workspace "${name}" --omit=dev`, {
    cwd: repoRootPath,
    stdio: [process.stdin, process.stdout, process.stderr],
  });
};
