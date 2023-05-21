const ghaCore = require('@actions/core');
const {
  AzureCloudInstance,
  AuthError,
  buildAppConfiguration,
  ConfidentialClientApplication,
} = require('@azure/msal-node');

const { buildNodeSystemOptions } = require('@thnetii/gh-actions-msal-client');

const { onJwtToken } = require('./utils');

const clientIdSym = Symbol('#clientId');

class GhaMsalAccessTokenProvider {
  /**
   * @param {import('@actions/http-client').HttpClient} httpClient
   * @param {string} clientId
   * @param {string | Exclude<import('@azure/msal-node').Configuration['auth']['clientCertificate'], undefined>} assertionInfo
   * @param {string} tenantId
   * @param {AzureCloudInstance | undefined} [instance]
   */
  constructor(httpClient, clientId, assertionInfo, tenantId, instance) {
    this[clientIdSym] = clientId;
    /** @type {import('@azure/msal-node').Configuration} */
    const config = {
      auth: {
        clientId,
        azureCloudOptions: {
          tenant: tenantId,
          azureCloudInstance: instance || AzureCloudInstance.AzurePublic,
        },
      },
      system: buildNodeSystemOptions(httpClient),
    };
    if (typeof assertionInfo === 'string')
      config.auth.clientAssertion = assertionInfo;
    else if (assertionInfo?.privateKey && assertionInfo?.thumbprint)
      config.auth.clientCertificate = assertionInfo;
    this.msalApp = new ConfidentialClientApplication(
      buildAppConfiguration(config)
    );
  }

  /**
   * @param {string | undefined} [resource]
   */
  async acquireAccessToken(resource) {
    const { msalApp } = this;
    ghaCore.debug('Acquiring MSAL access token . . .');
    if (!resource) {
      // eslint-disable-next-line no-param-reassign
      resource = this[clientIdSym];
      ghaCore.debug(
        `No resource requested for access token audience, using client id instead.`
      );
    }
    const authResult = await msalApp.acquireTokenByClientCredential({
      scopes: [`${resource || this[clientIdSym]}/.default`],
    });
    if (!authResult)
      throw new AuthError(undefined, 'Authentication result is null');
    const { accessToken, scopes } = authResult;
    onJwtToken(accessToken);
    if (ghaCore.isDebug()) {
      for (const scope of scopes) ghaCore.debug(`Available scope: ${scope}`);
    }
    return authResult;
  }
}

module.exports = {
  GhaMsalAccessTokenProvider,
};
