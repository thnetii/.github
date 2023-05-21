const ghaCore = require('@actions/core');
const { AzureCloudInstance } = require('@azure/msal-node');

const {
  getInput,
  getBooleanInput,
} = require('@thnetii/gh-actions-core-helpers');

module.exports = {
  getActionInputs() {
    const clientId = getInput('client-id', {
      required: true,
      trimWhitespace: true,
    });
    const tenantId = getInput('tenant-id', {
      required: true,
      trimWhitespace: true,
    });
    const instance =
      /** @type {AzureCloudInstance} */ (
        getInput('instance', { required: false, trimWhitespace: true })
      ) || AzureCloudInstance.AzurePublic;
    const resource =
      getInput('resource', {
        required: false,
        trimWhitespace: true,
      }) || clientId;
    const idTokenAudience =
      getInput('id-token-audience', {
        required: false,
        trimWhitespace: true,
      }) || undefined;
    const useClientCertificate =
      getBooleanInput('use-client-certificate', {
        required: false,
        trimWhitespace: true,
      }) || false;
    return {
      clientId,
      tenantId,
      instance,
      resource,
      idTokenAudience,
      useClientCertificate,
    };
  },

  /**
   * @param {string | undefined} [audience]
   */
  async getGithubActionsToken(audience) {
    ghaCore.info(
      `Requesting GitHub Actions ID token for audience: '${audience}'`
    );
    const idToken = await ghaCore.getIDToken(audience);
    return idToken;
  },
};
