const path = require('path');
const ghaCore = require('@actions/core');
const { exec } = require('@actions/exec');

const formatterPath = path.join(__dirname, 'formatter.js');

const {
  getInput,
  getMultilineInput,
  getNpmExecArguments,
} = require('@thnetii/gh-actions-core-helpers');

const toolArgs = getMultilineInput('arguments');
const execCwd = getInput('working-directory');
const npmExecArgs = getNpmExecArguments();
npmExecArgs.push('--', 'eslint', '--format', formatterPath, ...toolArgs);

exec('npm', npmExecArgs, { cwd: execCwd, ignoreReturnCode: true }).then(
  (exitCode) => {
    ghaCore.setOutput('eslint-exitcode', exitCode);
    process.exitCode = exitCode;
  },
);
