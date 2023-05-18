const crypto = require('node:crypto');

const {
  buildAppConfiguration,
  AzureCloudInstance,
  ConfidentialClientApplication,
} = require('@azure/msal-node');

const { loggerOptions } = require('./GhaMsalLogging');
const { GhaMsalNetworkModule } = require('./GhaMsalNetworkModule');

/**
 * @param {import('@actions/http-client').HttpClient} httpClient
 * @param {string} clientId
 * @param {string} tenantId
 * @param {AzureCloudInstance | undefined} [instance]
 */
function createMsalConfigurationTemplate(
  httpClient,
  clientId,
  tenantId,
  instance
) {
  /** @type {Parameters<import('@azure/msal-node')['buildAppConfiguration']>[0]} */
  const config = {
    auth: {
      clientId,
      azureCloudOptions: {
        azureCloudInstance: instance || AzureCloudInstance.AzurePublic,
        tenant: tenantId,
      },
    },
    system: {
      networkClient: new GhaMsalNetworkModule(httpClient),
      loggerOptions,
    },
  };
  return config;
}

module.exports = {
  /**
   * @param {import('@actions/http-client').HttpClient} httpClient
   * @param {string} clientId
   * @param {string} githubActionsIdToken
   * @param {string} tenantId
   * @param {AzureCloudInstance | undefined} [instance=AzureCloudInstance.Public]
   */
  createMsalAppFromIdToken(
    httpClient,
    clientId,
    githubActionsIdToken,
    tenantId,
    instance
  ) {
    const configTemplate = createMsalConfigurationTemplate(
      httpClient,
      clientId,
      tenantId,
      instance
    );
    configTemplate.auth.clientAssertion = githubActionsIdToken;
    const msalApp = new ConfidentialClientApplication(
      buildAppConfiguration(configTemplate)
    );
    return msalApp;
  },

  /**
   * @param {import('@actions/http-client').HttpClient} httpClient
   * @param {string} clientId
   * @param {string} certificatePem
   * @param {string} privateKeyPem
   * @param {string} tenantId
   * @param {AzureCloudInstance | undefined} [instance=AzureCloudInstance.Public]
   */
  createMsalAppFromCertificate(
    httpClient,
    clientId,
    certificatePem,
    privateKeyPem,
    tenantId,
    instance
  ) {
    const configTemplate = createMsalConfigurationTemplate(
      httpClient,
      clientId,
      tenantId,
      instance
    );
    const x509 = new crypto.X509Certificate(certificatePem);
    configTemplate.auth.clientCertificate = {
      thumbprint: x509.fingerprint256,
      privateKey: privateKeyPem,
      x5c: certificatePem,
    };
    const msalApp = new ConfidentialClientApplication(
      buildAppConfiguration(configTemplate)
    );
    return msalApp;
  },
};
