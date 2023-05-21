const ghaCore = require('@actions/core');
const { AzureCloudInstance } = require('@azure/msal-node');

const { GhaHttpClient } = require('@thnetii/gh-actions-http-client');

const { getGithubActionsToken } = require('./utils');
const { GhaMsalAccessTokenProvider } = require('./GhaMsalAccessTokenProvider');
const { GhaServicePrincipalUpdater } = require('./GhaServicePrincipalUpdater');

function getState() {
  const clientId = ghaCore.getState('client-id');
  const tenantId = ghaCore.getState('tenant-id');
  const instance =
    /** @type {AzureCloudInstance} */ (ghaCore.getState('instance')) ||
    AzureCloudInstance.AzurePublic;
  const idTokenAudience = ghaCore.getState('id-token-audience') || undefined;
  const keyId = ghaCore.getState('keyCredential-keyId');
  return {
    clientId,
    tenantId,
    instance,
    idTokenAudience,
    keyId,
  };
}

async function cleanup() {
  const { clientId, tenantId, instance, idTokenAudience, keyId } = getState();
  if (!clientId || !tenantId || !keyId) return;
  const idToken = await getGithubActionsToken(idTokenAudience);
  const msalHttpClient = new GhaHttpClient();
  try {
    const { msalApp } = new GhaMsalAccessTokenProvider(
      msalHttpClient,
      clientId,
      idToken,
      tenantId,
      instance
    );
    const msgraphClient = new GhaServicePrincipalUpdater(msalApp, clientId);
    try {
      await msgraphClient.removeKeyCredentialByKeyId(keyId);
    } finally {
      msgraphClient.dispose();
    }
  } finally {
    msalHttpClient.dispose();
  }
}

cleanup();
