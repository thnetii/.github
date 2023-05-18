const ghaCore = require('@actions/core');
const { AzureCloudInstance, AuthError } = require('@azure/msal-node');

const { getInput } = require('@thnetii/gh-actions-core-helpers');

const { GhaHttpClient } = require('./GhaHttpClient');
const { createMsalAppFromIdToken } = require('./GhaMsalAppProvider');

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
  return {
    clientId,
    tenantId,
    instance,
    resource,
    idTokenAudience,
  };
}

/**
 * @param {string | undefined} [audience]
 */
async function getGithubActionsToken(audience) {
  ghaCore.debug(
    `Requesting GitHub Actions ID token for audience: '${audience}'`
  );
  const ghaIdToken = await ghaCore.getIDToken(audience);
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
}

/**
 * @param {import('@azure/msal-node').IConfidentialClientApplication} msalApp
 * @param {string} resource
 */
async function acquireMsalToken(msalApp, resource) {
  let result;
  try {
    result = await msalApp.acquireTokenByClientCredential({
      scopes: [`${resource}/.default`],
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
    const authError = new AuthError(
      undefined,
      'MSAL authentication result is null'
    );
    ghaCore.setFailed(authError.message);
    throw authError;
  }
  const { accessToken } = result;
  ghaCore.setSecret(accessToken);
  const [, , signature] = accessToken.split('.', 3);
  if (signature) ghaCore.setSecret(signature);
  return result;
}

async function run() {
  const { clientId, tenantId, instance, resource, idTokenAudience } =
    getActionInputs();
  const idToken = await getGithubActionsToken(idTokenAudience);
  const msalHttpClient = new GhaHttpClient();
  try {
    const msalApp = createMsalAppFromIdToken(
      msalHttpClient,
      clientId,
      idToken,
      tenantId,
      instance
    );
    const result = await acquireMsalToken(msalApp, resource);
    ghaCore.setOutput('result', result);
    if (ghaCore.isDebug()) ghaCore.debug(JSON.stringify(result, undefined, 2));
    ghaCore.setOutput('access-token', result.accessToken);
  } finally {
    msalHttpClient.dispose();
  }
}

run();
