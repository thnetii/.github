const { GhaHttpClient } = require('@thnetii/gh-actions-http-client');

const { loggerOptions } = require('./GhaMsalLogging');
const { GhaMsalNetworkModule } = require('./GhaMsalNetworkModule');
const {
  GhaConfidentialClientHttpAuthenticationHandler,
} = require('./GhaConfidentialClientCredentialHandler');

/**
 * @typedef {Required<Pick<T, K>> & Omit<T, K>} RequiredProperty
 * @template T
 * @template {keyof T} K
 */

module.exports = {
  /**
   * @param {import('@actions/http-client').HttpClient | undefined} [httpClient]
   * @returns {RequiredProperty<import('@azure/msal-node').NodeSystemOptions, 'loggerOptions' | 'networkClient'>}
   */
  buildNodeSystemOptions(httpClient) {
    // eslint-disable-next-line no-param-reassign
    httpClient = httpClient || new GhaHttpClient();
    return {
      loggerOptions,
      networkClient: new GhaMsalNetworkModule(httpClient),
    };
  },
  GhaConfidentialClientHttpAuthenticationHandler,
};
