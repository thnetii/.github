const ghaCore = require('@actions/core');
const { AzureCloudInstance } = require('@azure/msal-node');

const { getInput } = require('@thnetii/gh-actions-core-helpers');

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
    const authMethod =
      /** @type {import('./types').GhaActionAuthMethod} */ (
        getInput('auth-method', {
          required: false,
          trimWhitespace: true,
        })
      ) || 'ms-idp-federated-credential';
    return {
      clientId,
      tenantId,
      instance,
      resource,
      idTokenAudience,
      authMethod,
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

  /** @param {string} token */
  onJwtToken(token) {
    if (!token) return;
    ghaCore.setSecret(token);
    const [, body, signature] = token.split('.', 3);
    // Special protection for the token signature.
    // Without it the rest of the token is safe to be displayed.
    if (signature) ghaCore.setSecret(signature);
    if (ghaCore.isDebug()) {
      if (body) {
        try {
          const bodyDecoded = Buffer.from(body, 'base64url').toString('utf-8');
          ghaCore.debug(`JWT: ${bodyDecoded}`);
        } catch {
          ghaCore.debug(`JWT-ish (body is not Base64 encoded): ${body}`);
        }
      } else {
        ghaCore.debug('Non JWT received.');
      }
    }
  },
};
