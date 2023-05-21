/* eslint-disable no-console */
const { createRequire } = require('node:module');
const { execSync } = require('node:child_process');
const path = require('node:path');

/** @param {string} actionPath */
module.exports = async (actionPath) => {
  const actionRequire = createRequire(actionPath);
  const actionPackageJsonPath = path.join(actionPath, 'package.json');
  const { name, dependencies = {} } = actionRequire(actionPackageJsonPath);
  if (typeof dependencies !== 'object')
    throw new TypeError(
      'Expected package dependencies to be a JSON object value'
    );
  const repoRootPath = path.resolve(path.join(__dirname, '..', '..'));
  let unfulfilledDependencies = false;
  try {
    for (const dependency of Object.keys(dependencies)) {
      actionRequire(dependency);
    }
  } catch {
    unfulfilledDependencies = true;
  }
  if (!unfulfilledDependencies) {
    console.log(`All dependencies of package ${name} are installed.`);
    return;
  }

  console.log(`Executing npm to install dependencies.`);
  execSync(`npm clean-install --workspaces --omit=dev`, {
    cwd: repoRootPath,
    stdio: [process.stdin, process.stdout, process.stderr],
  });
};
