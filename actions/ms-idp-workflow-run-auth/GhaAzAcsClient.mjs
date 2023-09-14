import { info } from '@actions/core';
import { HttpClientError, HttpCodes } from '@actions/http-client';
import { AzureCloudInstance } from '@azure/msal-node';

import { onJwtToken } from './utils.mjs';

const httpClientSym = Symbol('#httpClient');
const clientIdSym = Symbol('#clientId');
const clientSecretSym = Symbol('#clientSecret');
const realmSym = Symbol('#realm');
const instanceSym = Symbol('#instance');

class GhaAzAcsClient {
  /**
   * @param {import('@actions/http-client').HttpClient} httpClient
   * @param {string} clientId
   * @param {string} clientSecret
   * @param {string} realm Tenant ID or domain name
   * @param {AzureCloudInstance | undefined} [instance=AzureCloudInstance.AzurePublic]
   */
  constructor(httpClient, clientId, clientSecret, realm, instance) {
    this[httpClientSym] = httpClient;
    this[clientIdSym] = clientId;
    this[clientSecretSym] = clientSecret;
    this[realmSym] = realm;
    this[instanceSym] = instance || AzureCloudInstance.AzurePublic;
    this.tokenEndpoint = /** @type {string | undefined} */ (undefined);
  }

  async updateMetadata() {
    const httpClient = this[httpClientSym];
    const realm = this[realmSym];
    const instance = this[instanceSym];

    const url = `${instance}/metadata/json/1?realm=${encodeURIComponent(
      realm,
    )}`;
    /** @type {import('@actions/http-client/lib/interfaces.js').TypedResponse<import('./GhaAzAcsClient.types.js').AzAcsMetadataDocument>} */
    const resp = await httpClient.getJson(url);
    const { result, statusCode } = resp;
    if (!result)
      throw new HttpClientError(
        `Azure Access Control Service Metadata for realm '${realm}' not available.`,
        statusCode,
      );
    const { realm: realmFromMetadata, endpoints } = result;
    this[realmSym] = realmFromMetadata || realm;
    if (Array.isArray(endpoints)) {
      const oauthEndpoint = endpoints.find(
        (i) => i.protocol === 'OAuth2' && i.usage === 'issuance',
      );
      if (oauthEndpoint && oauthEndpoint.location)
        this.tokenEndpoint = oauthEndpoint.location;
    }
    return result;
  }

  /**
   * @param {string} resource
   */
  async acquireTokenByClientCredential(resource) {
    const httpClient = this[httpClientSym];

    let { tokenEndpoint } = this;
    for (let attempt = 0; !tokenEndpoint && attempt < 60; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      await this.updateMetadata();
      tokenEndpoint = this.tokenEndpoint;
      if (!tokenEndpoint) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          setTimeout(resolve, 5000);
        });
      } else break;
    }
    if (!tokenEndpoint)
      throw new Error('Unable to get ACS OAuth2 Token endpoint');

    const { [realmSym]: realm, [clientSecretSym]: clientSecret } = this;
    let clientId = this[clientIdSym];
    if (realm) {
      const suffix = `@${realm}`;
      clientId += suffix;
      // eslint-disable-next-line no-param-reassign
      resource += suffix;
    }

    info(`Acquiring ACS access token for resource: ${resource}`);
    const payload = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      resource,
    }).toString();
    const resp = await httpClient.post(tokenEndpoint, payload, {
      'conent-type': 'application/x-www-form-urlencoded',
    });
    const {
      message: { statusCode, headers },
    } = resp;
    const body = await resp.readBody();
    /**
     * @type {import('./GhaAzAcsClient.types.js').AzAcsOAuthEndpointHttpResponse}
     */
    const typedResponse = {
      statusCode: statusCode || HttpCodes.InternalServerError,
      headers,
      result: JSON.parse(body),
    };
    if (typedResponse.statusCode === HttpCodes.OK) {
      info('Successfully acquired ACS access token.');
      const {
        result: { access_token: token },
      } = typedResponse;
      onJwtToken(token);
      return typedResponse;
    }
    const {
      result: { error, error_description: desc, error_uri: errUri },
      statusCode: errorCode,
    } = typedResponse;
    throw new HttpClientError(`${error}: ${desc} [${errUri}]`, errorCode);
  }
}

export default GhaAzAcsClient;
