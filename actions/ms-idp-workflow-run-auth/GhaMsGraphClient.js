/* eslint-disable no-use-before-define */
const {
  AuthError,
  ClientAssertion,
  CryptoProvider,
} = require('@azure/msal-node');
const { HttpClient, HttpClientError } = require('@actions/http-client');
const { BearerCredentialHandler } = require('@actions/http-client/lib/auth');

const idSym = Symbol('#id');
const httpClientSym = Symbol('#httpClient');

/**
 * @param {import('@azure/msal-node').IConfidentialClientApplication} msalApp
 */
async function createMsGraphHttpClient(msalApp) {
  /** @type {Parameters<msalApp['acquireTokenByClientCredential']>[0]} */
  const request = { scopes: ['https://graph.microsoft.com/.default'] };
  const result = await msalApp.acquireTokenByClientCredential(request);
  if (!result) throw new AuthError(undefined, 'Authentication result is null');
  const authHandler = new BearerCredentialHandler(result.accessToken);
  return new HttpClient(undefined, [authHandler]);
}

const msGraphV1Url = 'https://graph.microsoft.com/v1.0';

class GhaMsGraphClient {
  /**
   * @param {import('@azure/msal-node').IConfidentialClientApplication} msalApp
   */
  constructor(msalApp) {
    const httpClientPromise = createMsGraphHttpClient(msalApp);
    this[httpClientSym] = httpClientPromise;
    const $this = this;
    this.servicePrincipals = {
      /** @param {string} id */
      byId(id) {
        return servicePrincipalEntity.call(
          $this,
          `${msGraphV1Url}/servicePrincipals('${id}')`
        );
      },
      /** @param {string} appId */
      byAppId(appId) {
        return servicePrincipalEntity.call(
          $this,
          `${msGraphV1Url}/servicePrincipals(appId='${appId}')`
        );
      },
    };
  }

  async dispose() {
    try {
      const httpClient = await this[httpClientSym];
      httpClient.dispose();
    } finally {
      /** ignore errors */
    }
  }
}

/**
 * @this {GhaMsGraphClient}
 * @param {string} baseUrl
 */
function servicePrincipalEntity(baseUrl) {
  const httpClientPromise = this[httpClientSym];
  return {
    [idSym]: /** @type {string | undefined} */ (undefined),
    /**
     * @param {TSelect | undefined} [$select]
     * @template {Object} [TSelect=Record<string, unknown>]
     * @returns {Promise<{
     *  [TProp in keyof TSelect]: TSelect[TProp];
     * }>}
     */
    async get($select) {
      const httpClient = await httpClientPromise;
      const requUrl =
        typeof $select === 'object'
          ? `${baseUrl}?$select=${Object.keys($select)
              .map((p) => encodeURIComponent(p))
              .join(',')}`
          : baseUrl;
      const { result, statusCode } = await httpClient.getJson(requUrl);
      if (!result)
        throw new HttpClientError(
          `Response payload from '${requUrl}' is null`,
          statusCode
        );
      if ('id' in result) this[idSym] = /** @type {string} */ (result.id);
      return result;
    },

    /**
     * @param {Awaited<ReturnType<import('./GhaOpenSslCertProvider')['generateCertificate']>>} certificate
     */
    async addClientAssertionCertificate(certificate) {
      const httpClient = await httpClientPromise;
      let spnId = this[idSym];
      if (!spnId) {
        const entity = await this.get({ id: '' });
        spnId = entity.id;
      }
      const url = `${baseUrl}/addKey`;
      const assertion = ClientAssertion.fromCertificate(
        certificate.thumbprint,
        certificate.privateKey,
        certificate.certificate
      );
      const proof = assertion.getJwt(
        new CryptoProvider(),
        spnId,
        '00000002-0000-0000-c000-000000000000'
      );
      const requ = {
        keyCredential: {
          keyId: certificate.uuid,
          displayName: certificate.commonName,
          key: Buffer.from(certificate.certificate).toString('base64'),
          customKeyIdentifier: certificate.thumbprint,
          type: 'AsymmetricX509Cert',
          usage: 'Verify',
        },
        proof,
      };
      const resp = await httpClient.postJson(url, requ);
      if (!resp.result)
        throw new HttpClientError(
          `Response from '${url}' is null`,
          resp.statusCode
        );
      return resp.result;
    },
  };
}

module.exports = {
  GhaMsGraphClient,
};
