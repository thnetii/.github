const ghaCore = require('@actions/core');
const { AuthError } = require('@azure/msal-node');

const msalAppSym = Symbol('#msalApp');

/** @typedef {import('@microsoft/microsoft-graph-client').AuthenticationProvider} IAuthenticationProvider */
/** @implements IAuthenticationProvider */
class GhaMsalConfidentialClientAuthenticationProvider {
  /**
   * @param {import('@azure/msal-node').IConfidentialClientApplication} msalApp
   */
  constructor(msalApp) {
    this[msalAppSym] = msalApp;
  }

  /** @type {IAuthenticationProvider['getAccessToken']} */
  async getAccessToken(options) {
    const { scopes = ['https://graph.microsoft.com/.default'] } = options || {};
    const msalApp = this[msalAppSym];
    const authResult = await msalApp.acquireTokenByClientCredential({ scopes });
    if (!authResult)
      throw new AuthError(undefined, 'Authentication result is null');
    const { accessToken } = authResult;
    if (accessToken) ghaCore.setSecret(accessToken);
    const [, , signature] = accessToken.split('.', 3);
    if (signature) ghaCore.setSecret(signature);
    return accessToken;
  }
}

module.exports = {
  GhaMsalConfidentialClientAuthenticationProvider,
};
