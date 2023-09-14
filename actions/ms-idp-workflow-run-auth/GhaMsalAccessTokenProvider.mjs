import { debug, info, isDebug } from '@actions/core';
import {
  AzureCloudInstance,
  AuthError,
  buildAppConfiguration,
  ConfidentialClientApplication,
} from '@azure/msal-node';

import { buildNodeSystemOptions } from '@thnetii/gh-actions-msal-client';

import { onJwtToken } from './utils.mjs';

const clientIdSym = Symbol('#clientId');

class GhaMsalAccessTokenProvider {
  /**
   * @param {import('@actions/http-client').HttpClient} httpClient
   * @param {string} clientId
   * @param {string | Exclude<import('@azure/msal-node').Configuration['auth']['clientCertificate'], undefined> | { clientSecret: string }} assertionInfo
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
    else if ('clientSecret' in assertionInfo) {
      config.auth.clientSecret = assertionInfo.clientSecret;
    } else if (assertionInfo?.privateKey && assertionInfo?.thumbprint)
      config.auth.clientCertificate = assertionInfo;
    this.msalApp = new ConfidentialClientApplication(
      buildAppConfiguration(config),
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
      debug(
        `No resource requested for access token audience, using client id instead.`,
      );
    }
    info(`Acquiring MSAL access token for resource: ${resource}`);
    const authResult = await msalApp.acquireTokenByClientCredential({
      scopes: [`${resource || this[clientIdSym]}/.default`],
    });
    if (!authResult)
      throw new AuthError(undefined, 'Authentication result is null');
    info('Sucessfully acquired MSAL access token.');
    const { accessToken, scopes } = authResult;
    onJwtToken(accessToken);
    if (isDebug()) {
      for (const scope of scopes) debug(`Available scope: ${scope}`);
    }
    return authResult;
  }
}

export default {
  GhaMsalAccessTokenProvider,
};
