const assert = require('assert');

const ghaCore = require('@actions/core');
const { HttpClient } = require('@actions/http-client');

/**
 * @param {HttpClient} httpClient
 */
async function cleanup(httpClient) {
  const clientId = ghaCore.getState('client-id');
  const accessToken = ghaCore.getState('msgraph-access-token');
  const keyId = ghaCore.getState('client-secret-key-id');
  const { statusCode } = await httpClient.postJson(
    `https://graph.microsoft.com/v1.0/servicePrincipals(appId='${clientId}')/removePassword`,
    {
      keyId,
    },
    {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    }
  );
  assert(statusCode === 204);
}

async function main() {
  const httpClient = new HttpClient();
  try {
    await cleanup(httpClient);
  } finally {
    httpClient.dispose();
  }
}

main();
