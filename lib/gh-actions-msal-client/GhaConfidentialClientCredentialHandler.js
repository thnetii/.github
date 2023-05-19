/* eslint-disable no-param-reassign */

const { AuthError } = require('@azure/msal-node');

/** @typedef {import('@actions/http-client/lib/interfaces').RequestHandler} RequestHandler */

const msalAppSym = Symbol('#msalApp');
const resourceSym = Symbol('#resource');
const accessTokenSym = Symbol('#accessToken');

/** @implements RequestHandler */
class GhaConfidentialClientHttpAuthenticationHandler {
  /**
   * @param {import('@azure/msal-node').IConfidentialClientApplication} msalApp
   * @param {string} resource
   */
  constructor(msalApp, resource) {
    this[msalAppSym] = msalApp;
    this[resourceSym] = resource;
    this[accessTokenSym] = /** @type {string | undefined} */ (undefined);
  }

  /** @type {RequestHandler['prepareRequest']} */
  // eslint-disable-next-line class-methods-use-this
  prepareRequest(options) {
    const accessToken = this[accessTokenSym];
    options.auth = `Bearer ${accessToken || ''}`;
  }

  /** @returns {ReturnType<RequestHandler['canHandleAuthentication']>} */
  // eslint-disable-next-line class-methods-use-this
  canHandleAuthentication() {
    return true;
  }

  /**
   * @param {Parameters<RequestHandler['handleAuthentication']>[0]} httpClient
   * @param {Parameters<Parameters<RequestHandler['handleAuthentication']>[0]['requestRaw']>[0]} requestInfo
   * @param {Parameters<Parameters<RequestHandler['handleAuthentication']>[0]['requestRaw']>[1]} data
   * @returns {ReturnType<RequestHandler['handleAuthentication']>}
   */
  async handleAuthentication(httpClient, requestInfo, data) {
    const msalApp = this[msalAppSym];
    const resource = this[resourceSym];
    const result = await msalApp.acquireTokenByClientCredential({
      scopes: [`${resource}/.default`],
    });
    if (!result)
      throw new AuthError(undefined, `Authentication result is null.`);
    const { accessToken } = result;
    this[accessTokenSym] = accessToken;
    this.prepareRequest(requestInfo.options);
    return httpClient.requestRaw(requestInfo, data);
  }
}

module.exports = {
  GhaConfidentialClientHttpAuthenticationHandler,
};
