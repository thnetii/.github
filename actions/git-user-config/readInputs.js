const core = require('@thnetii/gh-actions-core-helpers');

module.exports = {
  get 'working-directory'() {
    return core.getInput('working-directory') || undefined;
  },
  get 'config-global'() {
    return core.getBooleanInput('config-global');
  },
  get 'user-name'() {
    return core.getInput('user-name', { required: true });
  },
  get 'user-email'() {
    return core.getInput('user-email', { required: true });
  },
};
