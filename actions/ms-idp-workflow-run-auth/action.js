const ghaCore = require('@actions/core');
const {
  buildAppConfiguration,
  ConfidentialClientApplication,
  AzureCloudInstance,
  AuthError,
} = require('@azure/msal-node');

const { getInput } = require('@thnetii/gh-actions-core-helpers');

const { GhaMsalNetworkModule } = require('./GhaMsalNetworkModule');
const { loggerOptions } = require('./GhaMsalLogging');

const msalClientId = getInput('client-id', {
  required: true,
  trimWhitespace: true,
});
const msalTenantId = getInput('tenant-id', {
  required: true,
  trimWhitespace: true,
});
const msalInstance =
  /** @type {AzureCloudInstance} */ (
    getInput('instance', { required: false, trimWhitespace: true })
  ) || AzureCloudInstance.AzurePublic;
const msalResource =
  getInput('resource', {
    required: false,
    trimWhitespace: true,
  }) || msalClientId;

/** @type {Parameters<import('@azure/msal-node')['buildAppConfiguration']>[0]} */
const msalConfiguration = {
  auth: {
    clientId: msalClientId,
    azureCloudOptions: {
      azureCloudInstance: msalInstance,
      tenant: msalTenantId,
    },
  },
  system: {
    networkClient: new GhaMsalNetworkModule(),
    loggerOptions,
  },
};

const getGithubActionsToken = async () => {
  const ghaAudience = getInput('id-token-audience', {
    required: false,
    trimWhitespace: true,
  });
  ghaCore.debug(
    `Requesting GitHub Actions ID token for audience: '${ghaAudience}'`
  );
  const ghaIdToken = await ghaCore.getIDToken(ghaAudience);
  if (ghaCore.isDebug()) {
    const [, ghaIdTokenBodyBase64 = '{}'] = ghaIdToken.split('.', 3);
    const ghaIdTokenBodyBuffer = Buffer.from(ghaIdTokenBodyBase64, 'base64url');
    ghaCore.debug(
      `Client Assertion: ${JSON.stringify(
        ghaIdTokenBodyBuffer.toString('utf-8'),
        undefined,
        2
      )}`
    );
  }
  return ghaIdToken;
};

/** @param {string} ghaIdToken */
const acquireMsalToken = async (ghaIdToken) => {
  msalConfiguration.auth.clientAssertion = ghaIdToken;
  const msalAppConfiguration = buildAppConfiguration(msalConfiguration);
  const msalConfApp = new ConfidentialClientApplication(msalAppConfiguration);
  let result;
  try {
    result = await msalConfApp.acquireTokenByClientCredential({
      scopes: [`${msalResource}/.default`],
    });
  } catch (error) {
    if (error instanceof AuthError) {
      ghaCore.error(error.message, { title: error.errorMessage });
    } else {
      ghaCore.error(error instanceof Error ? error : `${error}`);
    }
    throw error;
  }
  if (result === null) {
    ghaCore.setFailed('MSAL authentication result is null');
    return;
  }
  ghaCore.setSecret(result.accessToken);
  ghaCore.setOutput('result', result);
  if (ghaCore.isDebug()) ghaCore.debug(JSON.stringify(result, undefined, 2));
  ghaCore.setOutput('access-token', result.accessToken);
};

const run = async () => {
  const ghaIdToken = await getGithubActionsToken();
  acquireMsalToken(ghaIdToken);
};

run();
