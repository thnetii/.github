const ghaCore = require('@actions/core');

const ghaHelpers = require('@thnetii/gh-actions-core-helpers');
const { GhaHttpClient } = require('@thnetii/gh-actions-http-client');

const { getActionInputs, getGithubActionsToken } = require('./utils');
const { GhaMsalAccessTokenProvider } = require('./GhaMsalAccessTokenProvider');
const { GhaServicePrincipalUpdater } = require('./GhaServicePrincipalUpdater');

function getState() {
  const keyCredentialId = ghaHelpers.getState('key-credential-id');
  const passwordCredentialId = ghaHelpers.getState('password-credential-id');
  return {
    keyCredentialId,
    passwordCredentialId,
    ...getActionInputs(),
  };
}

async function cleanup() {
  const {
    clientId,
    tenantId,
    instance,
    idTokenAudience,
    keyCredentialId,
    passwordCredentialId,
  } = getState();
  if (!keyCredentialId && !passwordCredentialId) {
    ghaCore.info('No temporary keyCredential registered for cleanup.');
    ghaCore.info('No temporary passwordCredential registered for cleanup.');
    return;
  }

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
      if (keyCredentialId) {
        ghaCore.info(
          `Detected keyCredential previously registered for cleanup. keyId: ${keyCredentialId}`
        );
        await msgraphClient.removeKeyCredentialByKeyId(keyCredentialId);
      }
      if (passwordCredentialId) {
        ghaCore.info(
          `Detected passwordCredential previously registered for cleanup. keyId: ${passwordCredentialId}`
        );
        await msgraphClient.removePasswordCredentialByKeyId(
          passwordCredentialId
        );
      }
    } finally {
      await msgraphClient.dispose();
    }
  } finally {
    msalHttpClient.dispose();
  }
}

cleanup();
