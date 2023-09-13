/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */

const { execSync, fork } = require('node:child_process');
const path = require('node:path');
const { createRequire } = require('node:module');

/** @param {string} actionPath */
module.exports = (actionPath) => {
  const repoRootPath = path.resolve(path.join(__dirname, '..', '..'));
  const repoTmpPath = path.join(repoRootPath, 'tmp');
  const repoTmpLibPath = path.join(repoTmpPath, 'lib');
  const actionPackagePath = path.join(actionPath, 'package.json');
  const actionRequire = createRequire(actionPath);
  /** @type {{name: string; dependencies?: Record<string, string>}} */
  const { name: actionPackageName, dependencies } =
    actionRequire(actionPackagePath);
  console.log(
    `Checking for unfulfilled dependencies of package: ${actionPackageName}`,
  );
  let unfulfilledDependencies = false;
  for (const dependencyName of Object.keys(
    typeof dependencies === 'object' ? dependencies : {},
  )) {
    try {
      process.stdout.write(`- ${dependencyName}`);
      actionRequire(dependencyName);
      console.log(': fulfilled');
    } catch (dependencyError) {
      if (dependencyError instanceof Error) {
        console.log(`: failed`);
      }
      console.log('At least one unfulfilled dependency detected.');
      unfulfilledDependencies = true;
      break;
    }
  }
  if (!unfulfilledDependencies) {
    console.log(`All dependencies are installed. Setup complete.`);
    return;
  }

  let npmCommand = `npm --prefix "${repoTmpPath}" install --global npm --no-audit --no-fund`;
  console.log(`[command]${npmCommand}`);
  execSync(npmCommand, {
    cwd: __dirname,
    stdio: [process.stdin, process.stdout, process.stderr],
  });

  // eslint-disable-next-line node/no-missing-require
  const npmPath = require.resolve('npm', {
    paths: [repoTmpLibPath, repoTmpPath],
  });
  console.log(`npm module located at: ${npmPath}`);
  const npmArgs = [
    'clean-install',
    '--workspaces',
    '--omit=dev',
    '--omit=peer',
    '--omit=optional',
    '--no-audit',
    '--no-fund',
  ];
  npmCommand = `npm ${npmArgs.join(' ')}`;
  console.log(`[command]${npmCommand}`);
  const npmFork = fork(npmPath, npmArgs, {
    cwd: repoRootPath,
  });
  npmFork.on('exit', (exitCode) => {
    console.log(`npm exited with exit code: ${exitCode}`);
    if (exitCode === 0) console.log('Setup complete');
  });
};
