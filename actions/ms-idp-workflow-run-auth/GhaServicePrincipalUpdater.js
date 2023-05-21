const { HttpClientError } = require('@actions/http-client');

const { GhaHttpClient } = require('@thnetii/gh-actions-http-client');
const {
  GhaConfidentialClientHttpAuthenticationHandler,
} = require('@thnetii/gh-actions-msal-client');

const httpClientSym = Symbol('#httpClient');
const spnUrlSym = Symbol('#spnUrl');
const removeKeyCredentialByKeyIdSym = Symbol('#removeKeyCredentialByKeyId');

class GhaServicePrincipalUpdater {
  /**
   * @param {import('@azure/msal-node').IConfidentialClientApplication} msalApp
   * @param {string} appId
   */
  constructor(msalApp, appId) {
    const msalHandler = new GhaConfidentialClientHttpAuthenticationHandler(
      msalApp,
      'https://graph.microsoft.com'
    );
    this[httpClientSym] = new GhaHttpClient(undefined, [msalHandler]);
    this.appId = appId;
    this[
      spnUrlSym
    ] = `https://graph.microsoft.com/v1.0/servicePrincipals(appId='${appId}')`;
  }

  async getKeyCredentials() {
    const url = `${this[spnUrlSym]}?$select=id,appId,appDisplayName,keyCredentials`;
    /**
     * @type {import('@actions/http-client/lib/interfaces').TypedResponse<
     *  Required<Pick<import('@microsoft/microsoft-graph-types').ServicePrincipal, 'id' | 'appId' | 'appDisplayName' | 'keyCredentials'>>
     * >}
     */
    const resp = await this[httpClientSym].getJson(url);
    const { result, headers, statusCode } = resp;
    if (!result)
      throw new HttpClientError(
        'Service Principal result entity is null',
        statusCode
      );
    return { result, headers, statusCode };
  }

  /**
   * @param {string} keyId
   * @param {number} $retry
   */
  async [removeKeyCredentialByKeyIdSym](keyId, $retry) {
    const {
      result: { keyCredentials },
      headers: { etag },
    } = await this.getKeyCredentials();

    const keyIdx = keyCredentials.findIndex((c) => c.keyId === keyId);
    if (keyIdx < 0) return;
    keyCredentials.splice(keyIdx, 1);

    try {
      // @ts-ignore
      // eslint-disable-next-line no-unused-vars
      const patchResp = await this[httpClientSym].patchJson(
        this[spnUrlSym],
        { keyCredentials },
        { 'If-Match': etag || '*' }
      );
    } catch (err) {
      if (err instanceof HttpClientError && err.statusCode === 412) {
        await this[removeKeyCredentialByKeyIdSym](keyId, $retry + 1);
        return;
      }
      throw err;
    }
  }

  /**
   * @param {string} keyId
   */
  removeKeyCredentialByKeyId(keyId) {
    return this[removeKeyCredentialByKeyIdSym](keyId, 0);
  }

  dispose() {
    this[httpClientSym].dispose();
  }
}

module.exports = {
  GhaServicePrincipalUpdater,
};
