const ghaCore = require('@actions/core');
const { HttpClientError } = require('@actions/http-client');
const { BearerCredentialHandler } = require('@actions/http-client/lib/auth');

const { GhaHttpClient } = require('@thnetii/gh-actions-http-client');

const httpClientSym = Symbol('#httpClient');
const spnUrlSym = Symbol('#spnUrl');
const removeKeyCredentialByKeyIdSym = Symbol('#removeKeyCredentialByKeyId');
const addCertificateKeyCredentialSym = Symbol('#addCertificateKeyCredential');

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
   * @param {number} $retry
   */
  async [removeKeyCredentialByKeyIdSym](keyId, $retry) {
    const httpClient = await this[httpClientSym];
    const {
      result: spnEntity,
      headers: { etag },
    } = await this.getKeyCredentials();
    let { keyCredentials } = spnEntity;
    if (!Array.isArray(keyCredentials)) keyCredentials = [];

    ghaCore.debug(
      `Removing keyCredential with keyId '${keyId}' from registered keyCredentials.`
    );
    const keyIdx = keyCredentials.findIndex((c) => c.keyId === keyId);
    if (keyIdx < 0) return;
    keyCredentials.splice(keyIdx, 1);

    try {
      ghaCore.debug(
        'Updating Microsoft Graph service principal entity with modified keyCredentials list'
      );
      // @ts-ignore
      // eslint-disable-next-line no-unused-vars
      const patchResp = await httpClient.patchJson(
        this[spnUrlSym],
        { keyCredentials },
        { 'If-Match': etag || '*' }
      );
    } catch (err) {
      if (err instanceof HttpClientError && err.statusCode === 412) {
        ghaCore.debug(
          'Optimistic concurrency check failed. Service principal entity has been updated by other party. Retrying.'
        );
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
    ghaCore.info(
      'Removing certificate from Microsoft Graph service principal entity'
    );
    return this[removeKeyCredentialByKeyIdSym](keyId, 0);
  }

  /**
   * @param {Awaited<ReturnType<import('./GhaOpenSslCertProvider')['generateCertificate']>>} keyPair
   * @param {number} $retry
   * @returns {Promise<import('@microsoft/microsoft-graph-types').KeyCredential>}
   */
  async [addCertificateKeyCredentialSym](keyPair, $retry) {
    const httpClient = await this[httpClientSym];
    const {
      result: spnEntity,
      headers: { etag },
    } = await this.getKeyCredentials();
    let { keyCredentials } = spnEntity;
    if (!Array.isArray(keyCredentials)) keyCredentials = [];

    ghaCore.debug('Adding certificate to list of registered keyCredentials');
    keyCredentials.push({
      key: keyPair.certificate,
      keyId: keyPair.uuid,
      customKeyIdentifier: keyPair.x509.fingerprint256,
      startDateTime: keyPair.x509.validFrom,
      endDateTime: keyPair.x509.validTo,
      displayName: keyPair.x509.subject,
      type: 'AsymmetricX509Cert',
      usage: 'Verify',
    });

    try {
      ghaCore.debug(
        'Updating Microsoft Graph service principal entity with modified keyCredentials list'
      );
      /**
       * @type {import('@actions/http-client/lib/interfaces').TypedResponse<
       *  Required<Pick<import('@microsoft/microsoft-graph-types').ServicePrincipal, 'keyCredentials'>>
       * >}
       */
      const patchResp = await httpClient.patchJson(
        this[spnUrlSym],
        { keyCredentials },
        { 'If-Match': etag || '*' }
      );
      if (patchResp.result && Array.isArray(patchResp.result.keyCredentials)) {
        keyCredentials = patchResp.result.keyCredentials;
      } else {
        keyCredentials = (await this.getKeyCredentials()).result.keyCredentials;
      }
    } catch (err) {
      if (err instanceof HttpClientError && err.statusCode === 412) {
        ghaCore.debug(
          'Optimistic concurrency check failed. Service principal entity has been updated by other party. Retrying.'
        );
        return this[addCertificateKeyCredentialSym](keyPair, $retry + 1);
      }
      throw err;
    }

    const keyCredential = keyCredentials.find(
      (k) => k.customKeyIdentifier === keyPair.x509.fingerprint256
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

  /**
   * @param {Awaited<ReturnType<import('./GhaOpenSslCertProvider')['generateCertificate']>>} certificate
   */
  addCertificateKeyCredential(certificate) {
    ghaCore.info(
      'Adding certificate to Microsoft Graph service principal entity'
    );
    return this[addCertificateKeyCredentialSym](certificate, 0);
  }

  async dispose() {
    const httpClient = await this[httpClientSym];
    httpClient.dispose();
  }
}

module.exports = {
  GhaServicePrincipalUpdater,
};
