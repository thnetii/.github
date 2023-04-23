const ghaCore = require('@actions/core');
const {
  buildAppConfiguration,
  ConfidentialClientApplication,
  AzureCloudInstance,
  LogLevel,
} = require('@azure/msal-node');

const { getInput } = require('@thnetii/gh-actions-core-helpers');

const { GhaMsalNetworkModule } = require('./GhaMsalNetworkModule');

const msalClientId = getInput('client-id', {
  required: true,
  trimWhitespace: true,
});
const msalTenantId = getInput('tenant-id', {
  required: true,
  trimWhitespace: true,
});
const msalClientAssertion = getInput('assertion', {
  required: true,
  trimWhitespace: true,
});
const msalInstance =
  /** @type {AzureCloudInstance} */ (
    getInput('instance', { required: false, trimWhitespace: true })
  ) || AzureCloudInstance.AzurePublic;
const msalAudience =
  getInput('audience', {
    required: false,
    trimWhitespace: true,
  }) || msalClientId;

/** @type {Parameters<import('@azure/msal-node')['buildAppConfiguration']>[0]} */
const msalConfiguration = {
  auth: {
    clientId: msalClientId,
    clientAssertion: msalClientAssertion,
    azureCloudOptions: {
      azureCloudInstance: msalInstance,
      tenant: msalTenantId,
    },
  },
  system: {
    networkClient: new GhaMsalNetworkModule(),
    loggerOptions: {
      loggerCallback(level, message) {
        if (level === LogLevel.Error) ghaCore.error(message);
        else if (level === LogLevel.Warning) ghaCore.warning(message);
        else if (level === LogLevel.Info) ghaCore.info(message);
        else ghaCore.debug(message);
      },
      logLevel: ghaCore.isDebug() ? LogLevel.Verbose : LogLevel.Info,
      piiLoggingEnabled: false,
    },
  },
};

const msalAppConfiguration = buildAppConfiguration(msalConfiguration);
const msalConfApp = new ConfidentialClientApplication(msalAppConfiguration);

/** @type {import('@azure/msal-node').ClientCredentialRequest} */
const msalTokenReq = {
  scopes: [`${msalAudience}/.default`],
};

(async () => {
  const result = await msalConfApp.acquireTokenByClientCredential(msalTokenReq);
  if (result === null) {
    ghaCore.setFailed('MSAL authentication result is null');
    return;
  }
  ghaCore.setSecret(result.accessToken);
  ghaCore.setOutput('result', result);
  if (ghaCore.isDebug()) ghaCore.debug(JSON.stringify(result, undefined, 2));
  ghaCore.setOutput('access-token', result.accessToken);
})();
