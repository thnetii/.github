const ghaCore = require('@actions/core');
const { HttpClientError } = require('@actions/http-client');
const { BearerCredentialHandler } = require('@actions/http-client/lib/auth');

const { GhaHttpClient } = require('@thnetii/gh-actions-http-client');

const httpClientSym = Symbol('#httpClient');
const spnUrlSym = Symbol('#spnUrl');

/**
 *
 * @param {import('./GhaMsalAccessTokenProvider').GhaMsalAccessTokenProvider} msalApp
 * @param {string} resource
 */
async function createHttpClient(msalApp, resource) {
  const { accessToken } = await msalApp.acquireAccessToken(resource);
  const msalHandler = new BearerCredentialHandler(accessToken);
  const httpClient = new GhaHttpClient(undefined, [msalHandler]);
  return httpClient;
}

class GhaServicePrincipalUpdater {
  /**
   * @param {import('./GhaMsalAccessTokenProvider').GhaMsalAccessTokenProvider} msalApp
   * @param {string} appId
   */
  constructor(msalApp, appId) {
    this[httpClientSym] = createHttpClient(
      msalApp,
      'https://graph.microsoft.com'
    );
    this.appId = appId;
    this[
      spnUrlSym
    ] = `https://graph.microsoft.com/v1.0/servicePrincipals(appId='${appId}')`;
  }

  async getKeyCredentials() {
    ghaCore.debug(
      'Retrieving all keyCredentials registered on Microsoft Graph service principal entity.'
    );
    const httpClient = await this[httpClientSym];
    const url = `${this[spnUrlSym]}?$select=id,appId,appDisplayName,keyCredentials`;
    /**
     * @type {import('@actions/http-client/lib/interfaces').TypedResponse<
     *  Required<Pick<import('@microsoft/microsoft-graph-types').ServicePrincipal, 'id' | 'appId' | 'appDisplayName' | 'keyCredentials'>>
     * >}
     */
    const resp = await httpClient.getJson(url);
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
   */
  async removeKeyCredentialByKeyId(keyId) {
    ghaCore.info(
      'Removing certificate from Microsoft Graph service principal entity'
    );
    const httpClient = await this[httpClientSym];
    const { result: spnEntity } = await this.getKeyCredentials();
    let { keyCredentials } = spnEntity;
    if (!Array.isArray(keyCredentials)) keyCredentials = [];

    ghaCore.debug(
      `Removing keyCredential with keyId '${keyId}' from registered keyCredentials.`
    );
    const keyIdx = keyCredentials.findIndex((c) => c.keyId === keyId);
    if (keyIdx < 0) return;
    keyCredentials.splice(keyIdx, 1);

    ghaCore.debug(
      'Updating Microsoft Graph service principal entity with modified keyCredentials list'
    );
    // @ts-ignore
    // eslint-disable-next-line no-unused-vars
    const patchResp = await httpClient.patchJson(this[spnUrlSym], {
      keyCredentials,
    });
  }

  /**
   * @param {Awaited<ReturnType<import('./GhaOpenSslCertProvider')['generateCertificate']>>} keyPair
   */
  async addCertificateKeyCredential(keyPair) {
    ghaCore.info(
      'Adding certificate to Microsoft Graph service principal entity'
    );
    const httpClient = await this[httpClientSym];
    const { result: spnEntity } = await this.getKeyCredentials();
    let { keyCredentials } = spnEntity;
    if (!Array.isArray(keyCredentials)) keyCredentials = [];

    ghaCore.debug('Adding certificate to list of registered keyCredentials');
    keyCredentials.push({
      key: keyPair.x509.raw.toString('base64'),
      keyId: keyPair.uuid,
      customKeyIdentifier: keyPair.thumbprint,
      startDateTime: keyPair.x509.validFrom,
      endDateTime: keyPair.x509.validTo,
      displayName: keyPair.x509.subject,
      type: 'AsymmetricX509Cert',
      usage: 'Verify',
    });

    ghaCore.debug(
      'Updating Microsoft Graph service principal entity with modified keyCredentials list'
    );
    /**
     * @type {import('@actions/http-client/lib/interfaces').TypedResponse<
     *  Required<Pick<import('@microsoft/microsoft-graph-types').ServicePrincipal, 'keyCredentials'>>
     * >}
     */
    const patchResp = await httpClient.patchJson(this[spnUrlSym], {
      keyCredentials,
    });
    if (patchResp.result && Array.isArray(patchResp.result.keyCredentials)) {
      keyCredentials = patchResp.result.keyCredentials;
    } else {
      keyCredentials = (await this.getKeyCredentials()).result.keyCredentials;
    }

    const keyCredential = keyCredentials.find(
      (k) => k.customKeyIdentifier === keyPair.thumbprint
    );
    if (!keyCredential)
      throw new Error(
        'Failed to update service principal with new key credential'
      );
    ghaCore.info(
      `Certificate added to service principal entity. keyId: ${keyCredential.keyId}`
    );
    return keyCredential;
  }

  async dispose() {
    const httpClient = await this[httpClientSym];
    httpClient.dispose();
  }
}

module.exports = {
  GhaServicePrincipalUpdater,
};
