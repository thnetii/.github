/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */

const { execSync } = require('node:child_process');
const path = require('node:path');
const { createRequire } = require('node:module');

/** @param {string} actionPath */
module.exports = (actionPath) => {
  const repoRootPath = path.resolve(path.join(__dirname, '..', '..'));
  const actionPackagePath = path.join(actionPath, 'package.json');
  const actionRequire = createRequire(actionPath);
  /** @type {{name: string; dependencies?: Record<string, string>}} */
  const { name: actionPackageName, dependencies } =
    actionRequire(actionPackagePath);
  console.log(
    `Checking for unfulfilled dependencies of package: ${actionPackageName}`
  );
  let unfulfilledDependencies = false;
  for (const dependencyName of Object.keys(
    typeof dependencies === 'object' ? dependencies : {}
  )) {
    try {
      actionRequire(dependencyName);
    } catch (dependencyError) {
      unfulfilledDependencies = true;
      break;
    }
  }
  if (!unfulfilledDependencies) {
    console.log(`All dependencies are installed. Setup complete.`);
    return;
  }
  console.log('At least one unfulfilled dependency detected. Installing...');
  const npmCommand = `npm clean-install --workspaces --omit=dev --no-audit --no-fund`;
  console.log(`[command]${npmCommand}`);
  execSync(npmCommand, {
    cwd: repoRootPath,
    stdio: [process.stdin, process.stdout, process.stderr],
  });
  console.log('Setup complete');
};
