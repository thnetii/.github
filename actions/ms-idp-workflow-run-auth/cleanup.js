const ghaCore = require('@actions/core');

const ghaHelpers = require('@thnetii/gh-actions-core-helpers');
const { GhaHttpClient } = require('@thnetii/gh-actions-http-client');

const { getActionInputs, getGithubActionsToken } = require('./utils');
const { GhaMsalAccessTokenProvider } = require('./GhaMsalAccessTokenProvider');
const { GhaServicePrincipalUpdater } = require('./GhaServicePrincipalUpdater');

function getState() {
  const keyId = ghaHelpers.getState('key-credential-id');
  return {
    keyId,
    ...getActionInputs(),
  };
}

async function cleanup() {
  const { clientId, tenantId, instance, idTokenAudience, keyId } = getState();
  if (!keyId) {
    ghaCore.info('No temporary keyCredential registered for cleanup.');
    return;
  }
  ghaCore.info(
    `Detected keyCredential previously registered for cleanup. keyId: ${keyId}`
  );

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
    const msgraphClient = new GhaServicePrincipalUpdater(msalApp, clientId);
    try {
      await msgraphClient.removeKeyCredentialByKeyId(keyId);
    } finally {
      await msgraphClient.dispose();
    }
  } finally {
    msalHttpClient.dispose();
  }
}

cleanup();
