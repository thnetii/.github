import { debug, info } from '@actions/core';
import { HttpClientError } from '@actions/http-client';
import { BearerCredentialHandler } from '@actions/http-client/lib/auth.js';

import { GhaHttpClient } from '@thnetii/gh-actions-http-client';

const httpClientSym = Symbol('#httpClient');
const spnUrlSym = Symbol('#spnUrl');

/**
 *
 * @param {InstanceType<import('./GhaMsalAccessTokenProvider.mjs')['default']>} msalApp
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
   * @param {InstanceType<import('./GhaMsalAccessTokenProvider.mjs')['default']>} msalApp
   * @param {string} appId
   */
  constructor(msalApp, appId) {
    this[httpClientSym] = createHttpClient(
      msalApp,
      'https://graph.microsoft.com',
    );
    this.appId = appId;
    this[
      spnUrlSym
    ] = `https://graph.microsoft.com/v1.0/servicePrincipals(appId='${appId}')`;
  }

  async getKeyCredentials() {
    debug(
      'Retrieving all keyCredentials registered on Microsoft Graph service principal entity.',
    );
    const httpClient = await this[httpClientSym];
    const url = `${this[spnUrlSym]}?$select=id,appId,appDisplayName,keyCredentials`;
    /**
     * @type {import('@actions/http-client/lib/interfaces.js').TypedResponse<
     *  Required<Pick<import('@microsoft/microsoft-graph-types').ServicePrincipal, 'id' | 'appId' | 'appDisplayName' | 'keyCredentials'>>
     * >}
     */
    const resp = await httpClient.getJson(url);
    const { result, headers, statusCode } = resp;
    if (!result)
      throw new HttpClientError(
        'Service Principal result entity is null',
        statusCode,
      );
    return { result, headers, statusCode };
  }

  /**
   * @param {string} keyId
   */
  async removeKeyCredentialByKeyId(keyId) {
    const httpClient = await this[httpClientSym];
    info('Removing certificate from Microsoft Graph service principal entity');
    const { result: spnEntity } = await this.getKeyCredentials();
    let { keyCredentials } = spnEntity;
    if (!Array.isArray(keyCredentials)) keyCredentials = [];

    debug(
      `Removing keyCredential with keyId '${keyId}' from registered keyCredentials.`,
    );
    const keyIdx = keyCredentials.findIndex((c) => c.keyId === keyId);
    if (keyIdx < 0) return;
    keyCredentials.splice(keyIdx, 1);
    for (const existingKeyCredential of keyCredentials) {
      delete existingKeyCredential.key;
    }

    debug(
      'Updating Microsoft Graph service principal entity with modified keyCredentials list',
    );
    // @ts-ignore
    // eslint-disable-next-line no-unused-vars
    const patchResp = await httpClient.patchJson(this[spnUrlSym], {
      keyCredentials,
    });
  }

  /**
   * @param {Awaited<ReturnType<import('./GhaOpenSslCertProvider.js')['generateCertificate']>>} keyPair
   */
  async addCertificateKeyCredential(keyPair) {
    const httpClient = await this[httpClientSym];
    info('Adding certificate to Microsoft Graph service principal entity');
    const { result: spnEntity } = await this.getKeyCredentials();
    let { keyCredentials } = spnEntity;
    if (!Array.isArray(keyCredentials)) keyCredentials = [];

    debug('Adding certificate to list of registered keyCredentials');
    const thumbprint = keyPair.thumbprint.toString('base64');
    for (const existingKeyCredential of keyCredentials) {
      delete existingKeyCredential.key;
    }
    keyCredentials.push({
      key: keyPair.x509.raw.toString('base64'),
      customKeyIdentifier: thumbprint,
      startDateTime: new Date(keyPair.x509.validFrom).toISOString(),
      endDateTime: new Date(keyPair.x509.validTo).toISOString(),
      displayName: keyPair.x509.subject,
      type: 'AsymmetricX509Cert',
      usage: 'Verify',
    });

    debug(
      'Updating Microsoft Graph service principal entity with modified keyCredentials list',
    );
    /**
     * @type {import('@actions/http-client/lib/interfaces.js').TypedResponse<
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
      (k) => k.customKeyIdentifier === thumbprint,
    );
    if (!keyCredential)
      throw new Error(
        'Failed to update service principal with new key credential',
      );
    info(
      `Certificate added to service principal entity. keyId: ${keyCredential.keyId}`,
    );
    return keyCredential;
  }

  /**
   * @param {string} keyId
   */
  async removePasswordCredentialByKeyId(keyId) {
    const httpClient = await this[httpClientSym];
    info(
      'Removing password credential from Microsoft Graph service principal entity',
    );
    const url = `${this[spnUrlSym]}/removePassword`;
    await httpClient.postJson(url, { keyId });
  }

  /**
   * @param {Pick<import('@microsoft/microsoft-graph-types').PasswordCredential, 'displayName' | 'startDateTime' | 'endDateTime' | 'customKeyIdentifier'>} [passwordCredential]
   */
  async addPasswordCredential(passwordCredential) {
    const httpClient = await this[httpClientSym];
    info(
      'Adding password credential to Microsoft Graph service principal entity',
    );
    const url = `${this[spnUrlSym]}/addPassword`;
    const request = {
      passwordCredential:
        typeof passwordCredential === 'object' ? passwordCredential : {},
    };
    /** @type {import('@actions/http-client/lib/interfaces.js').TypedResponse<Required<import('@microsoft/microsoft-graph-types').PasswordCredential>>} */
    const response = await httpClient.postJson(url, request);
    const { statusCode, result } = response;
    if (!result)
      throw new HttpClientError(
        'Password credential result is null',
        statusCode,
      );
    return result;
  }

  async dispose() {
    const httpClient = await this[httpClientSym];
    httpClient.dispose();
  }
}

export default GhaServicePrincipalUpdater;
