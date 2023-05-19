/* eslint-disable no-use-before-define */
const { AuthError } = require('@azure/msal-node');
const { HttpClient, HttpClientError } = require('@actions/http-client');
const { BearerCredentialHandler } = require('@actions/http-client/lib/auth');
const { Client } = require('@microsoft/microsoft-graph-client');

const idSym = Symbol('#id');
const httpClientSym = Symbol('#httpClient');
const servicePrincipalEntitySym = Symbol('#servicePrincipal');

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
  }

  async dispose() {
    try {
      const httpClient = await this[httpClientSym];
      httpClient.dispose();
    } finally {
      /** ignore errors */
    }
  }

  get servicePrincipals() {
    const $this = this;
    return {
      /** @param {string} id */
      byId(id) {
        return $this[servicePrincipalEntitySym](
          `${msGraphV1Url}/servicePrincipals('${id}')`
        );
      },
      /** @param {string} appId */
      byAppId(appId) {
        return $this[servicePrincipalEntitySym](
          `${msGraphV1Url}/servicePrincipals(appId='${appId}')`
        );
      },
    };
  }

  /**
   * @param {string} baseUrl
   */
  [servicePrincipalEntitySym](baseUrl) {
    const httpClientPromise = this[httpClientSym];
    return {
      [idSym]: /** @type {string | undefined} */ (undefined),
      /**
       * @param {TSelect | undefined} [$select]
       * @template {Object} [TSelect=Record<string, unknown>]
       * @returns {Promise<{
       *  [TProp in keyof TSelect]: TSelect[TProp];
       * } & Record<string, unknown>>}
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
       * @param {Object} requestBody
       * @param {TSelect | undefined} [$select]
       * @template {Object} [TSelect=Record<string, unknown>]
       * @returns {Promise<{
       *  [TProp in keyof TSelect]: TSelect[TProp];
       * } & Record<string, unknown>>}
       */
      async patch(requestBody, $select) {
        const httpClient = await httpClientPromise;
        const url = $select
          ? `${baseUrl}?$select=${Object.keys($select)
              .map((p) => encodeURIComponent(p))
              .join(',')}`
          : baseUrl;
        const { result } = await httpClient.patchJson(url, requestBody, {
          Prefer: 'return=representation',
        });
        return result;
      },

      /**
       * @param {MsGraphServicePrincipalAddKeyRequestBody} requestBody
       */
      async addKey(requestBody) {
        const httpClient = await httpClientPromise;
        const url = `${baseUrl}/addKey`;
        /** @type {import('@actions/http-client/lib/interfaces').TypedResponse<MsGraphKeyCredential>} */
        const { result, statusCode } = await httpClient.postJson(
          url,
          requestBody
        );
        if (!result)
          throw new HttpClientError(
            `Response from '${url}' is null`,
            statusCode
          );
        return result;
      },
    };
  }
}

module.exports = {
  GhaMsGraphClient,
};

/**
 * @typedef {{
 *  [P in K]-?: T[P];
 * } & Partial<Omit<T, K>>} PartiallyRequired
 * @template T
 * @template {keyof T} K
 */

/**
 * @typedef {Object} MsGraphKeyCredential Contains a key credential associated with an application or a service principal.
 * @property {string} [customKeyIdentifier] A 40-character binary type that can be used to identify the credential. Optional. When not provided in the payload, defaults to the thumbprint of the certificate.
 * @property {string} [displayName] Friendly name for the key. Optional.
 * @property {string} endDateTime The date and time at which the credential expires. The value represents date and time information using ISO 8601 format and is always in UTC time. For example, midnight UTC on Jan 1, 2014 is `2014-01-01T00:00:00Z`.
 * @property {string | null} key The certificate's raw data in byte array converted to Base64 string. Returned only on `$select` for a single object, that is, `GET applications/{applicationId}?$select=keyCredentials` or `GET servicePrincipals/{servicePrincipalId}?$select=keyCredentials`; otherwise, it is always `null`.
 * @property {string} keyId The unique identifier (GUID) for the key.
 * @property {string} startDateTime The date and time at which the credential becomes valid. The value represents date and time information using ISO 8601 format and is always in UTC time. For example, midnight UTC on Jan 1, 2014 is `2014-01-01T00:00:00Z`.
 * @property {string} type The type of key credential; for example, `Symmetric`, `AsymmetricX509Cert`.
 * @property {string} usage A string that describes the purpose for which the key can be used; for example, `Verify`.
 * @see https://learn.microsoft.com/en-us/graph/api/resources/keycredential?view=graph-rest-1.0
 */

/**
 * @typedef {Object} MsGraphPasswordCredential Represents a password credential associated with an application or a service principal.
 * @property {never} customKeyIdentifier Do not use.
 * @property {string} [displayName] Friendly name for the password. Optional.
 * @property {string} [endDateTime] The date and time at which the password expires represented using ISO 8601 format and is always in UTC time. For example, midnight UTC on Jan 1, 2014 is `2014-01-01T00:00:00Z`. Optional.
 * @property {string} hint Contains the first three characters of the password. Read-only.
 * @property {string} keyId The unique identifier for the password.
 * @property {string} [secretText] Read-only; Contains the strong passwords generated by Azure AD that are 16-64 characters in length. The generated password value is only returned during the initial POST request to `addPassword`. There is no way to retrieve this password in the future.
 * @property {string} [startDateTime] The date and time at which the password becomes valid. The Timestamp type represents date and time information using ISO 8601 format and is always in UTC time. For example, midnight UTC on Jan 1, 2014 is `2014-01-01T00:00:00Z`. Optional.
 */

/**
 * @typedef {Object} MsGraphServicePrincipalAddKeyRequestBody
 * @property {PartiallyRequired<MsGraphKeyCredential, 'key' | 'type' | 'usage'>} keyCredential The new servicePrincipal key credential to add. The type, usage and key are required properties for this usage. Supported key types are:
 *  - `AsymmetricX509Cert`: The usage must be `Verify`.
 *  - `X509CertAndPassword`: The usage must be `Sign`
 * @property {PartiallyRequired<MsGraphPasswordCredential, 'secretText'> | null} [passwordCredential] Only secretText is required to be set which should contain the password for the key. This property is required only for keys of type `X509CertAndPassword`. Set it to `null` otherwise.
 * @property {string} proof A self-signed JWT token used as a proof of possession of the existing keys. This JWT token must be signed using the private key of one of the servicePrincipal's existing valid certificates. The token should contain the following claims:
 *  - `aud` - Audience needs to be `00000002-0000-0000-c000-000000000000`.
 *  - `iss` - Issuer needs to be the **id** of the servicePrincipal that is making the call.
 *  - `nbf` - Not before time.
 *  - `exp` - Expiration time should be `nbf` + 10 mins.
 */
