/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */

const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs/promises');
const { createRequire } = require('node:module');

/** @param {string} actionPath */
module.exports = async (actionPath) => {
  const repoRootPath = path.resolve(path.join(__dirname, '..', '..'));
  const repoRootRequire = createRequire(repoRootPath);
  const repoRootPackageJson = path.join(repoRootPath, 'package.json');
  const { dependencies = {}, devDependencies = {} } =
    repoRootRequire(repoRootPackageJson);
  for (const [depPackageName, depPackageVersion] of Object.entries({
    ...dependencies,
    ...devDependencies,
  }).filter(([, v]) => typeof v === 'string' && v.startsWith('file:'))) {
    const depPackageRelPath = /** @type {string} */ (depPackageVersion)
      .substring(5)
      .trim();
    const depPackagePath = path.join(repoRootPath, depPackageRelPath);
    const depPackageJsonPath = path.join(depPackagePath, 'package.json');
    try {
      await fs.access(depPackageJsonPath, fs.constants.R_OK);
    } catch {
      await fs.mkdir(depPackagePath, { recursive: true });
      const depPackageJson = JSON.stringify({
        name: depPackageName,
        version: '0.0.0',
      });
      await fs.writeFile(depPackageJsonPath, depPackageJson, 'utf-8');
    }
  }
  const workspacePath = path.relative(repoRootPath, actionPath);
  const npmCommand = `npm install --workspace "${workspacePath}" --no-audit --no-fund --install-links`;
  console.log(`[command]${npmCommand}`);
  execSync(npmCommand, {
    cwd: repoRootPath,
    stdio: [process.stdin, process.stdout, process.stderr],
  });
};
