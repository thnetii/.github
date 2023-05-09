const assert = require('assert');

const ghaCore = require('@actions/core');
const { HttpClient } = require('@actions/http-client');
const { BearerCredentialHandler } = require('@actions/http-client/lib/auth');

/**
 * @param {HttpClient} httpClient
 * @param {string} clientId
 * @param {string} keyId
 */
async function cleanup(httpClient, clientId, keyId) {
  const removePasswordUrl = `https://graph.microsoft.com/v1.0/servicePrincipals(appId='${clientId}')/removePassword`;
  ghaCore.debug(
    `Executing Microsoft Graph REST API v1.0, servicePrincipal: removePassword with keyId = '${keyId}'`
  );
  ghaCore.debug(`Sending POST request to: ${removePasswordUrl}`);
  const { statusCode } = await httpClient.postJson(removePasswordUrl, {
    keyId,
  });
  assert(statusCode === 204);
}

async function main() {
  const clientId = ghaCore.getState('client-id');
  const accessToken = ghaCore.getState('msgraph-access-token');
  const keyId = ghaCore.getState('client-secret-key-id');
  const httpClient = new HttpClient(undefined, [
    new BearerCredentialHandler(accessToken),
  ]);
  try {
    await cleanup(httpClient, clientId, keyId);
  } finally {
    httpClient.dispose();
  }
}

main();
