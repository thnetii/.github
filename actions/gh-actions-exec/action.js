const ghaCore = require('@actions/core');
const { exec } = require('@actions/exec');
const {
  getInput,
  getMultilineInput,
} = require('@thnetii/gh-actions-core-helpers');

const toolCmd = getInput('command', { required: true });
const toolArgs = getMultilineInput('arguments');
const toolCwd = getInput('working-directory');

exec(toolCmd, toolArgs, {
  cwd: toolCwd,
  ignoreReturnCode: true,
}).then((exitCode) => {
  ghaCore.setOutput('command-exitcode', exitCode);
  process.exitCode = exitCode;
});
