const ghaCore = require('@actions/core');
const { AzureCloudInstance } = require('@azure/msal-node');

const { getInput } = require('@thnetii/gh-actions-core-helpers');

const { GhaHttpClient } = require('@thnetii/gh-actions-http-client');

const { getGithubActionsToken } = require('./utils');
const { GhaMsalAccessTokenProvider } = require('./GhaMsalAccessTokenProvider');

function getActionInputs() {
  const clientId = getInput('client-id', {
    required: true,
    trimWhitespace: true,
  });
  const tenantId = getInput('tenant-id', {
    required: true,
    trimWhitespace: true,
  });
  const instance =
    /** @type {AzureCloudInstance} */ (
      getInput('instance', { required: false, trimWhitespace: true })
    ) || AzureCloudInstance.AzurePublic;
  const resource =
    getInput('resource', {
      required: false,
      trimWhitespace: true,
    }) || clientId;
  const idTokenAudience =
    getInput('id-token-audience', {
      required: false,
      trimWhitespace: true,
    }) || undefined;
  ghaCore.saveState('client-id', clientId);
  ghaCore.saveState('tenant-id', tenantId);
  ghaCore.saveState('instance', instance);
  ghaCore.saveState('id-token-audience', idTokenAudience);
  return {
    clientId,
    tenantId,
    instance,
    resource,
    idTokenAudience,
  };
}

async function run() {
  const { clientId, tenantId, instance, resource, idTokenAudience } =
    getActionInputs();
  const idToken = await getGithubActionsToken(idTokenAudience);
  const msalHttpClient = new GhaHttpClient();
  try {
    const msalApp = new GhaMsalAccessTokenProvider(
      msalHttpClient,
      clientId,
      idToken,
      tenantId,
      instance
    );
    const result = await msalApp.acquireAccessToken(resource);
    const { accessToken } = result;
    ghaCore.setOutput('access-token', accessToken);
    ghaCore.setOutput('result', result);
  } finally {
    msalHttpClient.dispose();
  }
}

run();
