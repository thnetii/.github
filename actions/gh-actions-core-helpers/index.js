const ghaCore = require('@actions/core');

module.exports = {
  /** @type {typeof ghaCore.getInput} */
  getInput(name, options) {
    const val = ghaCore.getInput(name, options);
    ghaCore.debug(`INPUT ${name}: ${val}`);
    return val;
  },

  /** @type {typeof ghaCore.getMultilineInput} */
  getMultilineInput(name, options) {
    const val = ghaCore.getMultilineInput(name, options);
    ghaCore.debug(`INPUT ${name}: ${JSON.stringify(val)}`);
    return val;
  },

  /**
   * @param {string} name
   * @param {ghaCore.InputOptions} [options]
   */
  getBooleanInput(name, options) {
    const valString = ghaCore.getInput(name, options);
    let val;
    if (!valString && (!options || !options.required)) {
      val = undefined;
    } else {
      val = ghaCore.getBooleanInput(name, options);
    }
    ghaCore.debug(`INPUT ${name}: ${val}`);
    return val;
  },

  getNpmExecArguments() {
    const npmExecArgs = ['exec'];
    const { getInput, getBooleanInput, getMultilineInput } = module.exports;
    if (
      getBooleanInput('npm-exec-allow-package-install', { required: false })
    ) {
      npmExecArgs.push('--yes');
    }
    const execPackages = getMultilineInput('npm-exec-packages', {
      required: false,
    });
    for (const execPkg of execPackages) {
      npmExecArgs.push(`--package=${execPkg}`);
    }
    const npmWorkspace = getInput('npm-workspace', { required: false });
    if (npmWorkspace) {
      npmExecArgs.push('--workspace', npmWorkspace);
    } else if (getBooleanInput('npm-workspaces', { required: false })) {
      npmExecArgs.push('--workspaces');
      if (getBooleanInput('npm-include-workspace-root', { required: false })) {
        npmExecArgs.push('--include-workspace-root');
      }
    }
    return npmExecArgs;
  },
};
