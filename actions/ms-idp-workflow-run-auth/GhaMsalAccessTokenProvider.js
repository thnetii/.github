const ghaCore = require('@actions/core');
const {
  AzureCloudInstance,
  AuthError,
  buildAppConfiguration,
  ConfidentialClientApplication,
} = require('@azure/msal-node');

const { buildNodeSystemOptions } = require('@thnetii/gh-actions-msal-client');

const clientIdSym = Symbol('#clientId');

/** @param {string} token */
function onJwtToken(token) {
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
}

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
    if (!resource) {
      // eslint-disable-next-line no-param-reassign
      resource = this[clientIdSym];
      ghaCore.debug(
        `No resource requested for access token audience, using client id instead.`
      );
    }
    ghaCore.info(`Acquiring MSAL access token for resource '${resource}'. . .`);
    const authResult = await msalApp.acquireTokenByClientCredential({
      scopes: [`${resource || this[clientIdSym]}/.default`],
    });
    if (!authResult)
      throw new AuthError(undefined, 'Authentication result is null');
    ghaCore.info('Sucessfully acquired MSAL access token.');
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
