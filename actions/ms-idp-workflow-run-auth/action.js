const ghaCore = require('@actions/core');
const { AuthError } = require('@azure/msal-node');

const { saveState } = require('@thnetii/gh-actions-core-helpers');
const { GhaHttpClient } = require('@thnetii/gh-actions-http-client');

const { getActionInputs, getGithubActionsToken } = require('./utils');
const { GhaMsalAccessTokenProvider } = require('./GhaMsalAccessTokenProvider');
const { generateCertificate } = require('./GhaOpenSslCertProvider');
const { GhaServicePrincipalUpdater } = require('./GhaServicePrincipalUpdater');

/**
 * @param {import('@actions/http-client').HttpClient} httpClient
 */
async function acquireAccessToken(httpClient) {
  let maxAttempts = 1;
  const {
    clientId,
    tenantId,
    instance,
    resource,
    idTokenAudience,
    useClientCertificate,
  } = getActionInputs();
  const idToken = await getGithubActionsToken(idTokenAudience);
  let msalApp = new GhaMsalAccessTokenProvider(
    httpClient,
    clientId,
    idToken,
    tenantId,
    instance
  );

  if (useClientCertificate) {
    maxAttempts = 60;
    const keyPair = await generateCertificate();
    let keyCredential;
    const spnUpdater = new GhaServicePrincipalUpdater(msalApp, clientId);
    try {
      keyCredential = await spnUpdater.addCertificateKeyCredential(keyPair);
    } finally {
      await spnUpdater.dispose();
    }
    saveState('key-credential-id', keyCredential?.keyId);

    ghaCore.debug(
      'Replacing MSAL application with a new application using the temporary certificate for client authentication'
    );
    msalApp = new GhaMsalAccessTokenProvider(
      httpClient,
      clientId,
      {
        privateKey: keyPair.privateKey,
        thumbprint: keyPair.thumbprint.toString('hex'),
        // x5c: keyPair.certificate,
      },
      tenantId,
      instance
    );
  }

  let error;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let result;
    try {
      if (attempt > 0) {
        ghaCore.info(
          `Authentication attempt ${attempt} failed. Waiting 5 seconds for the system to propagate possibly missing credentials.`
        );
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          setTimeout(resolve, 5000);
        });
      }
      // eslint-disable-next-line no-await-in-loop
      result = await msalApp.acquireAccessToken(resource);
    } catch (err) {
      if (err instanceof AuthError) {
        error = err;
        // eslint-disable-next-line no-continue
        continue;
      }
      throw err;
    }
    if (!result) {
      error = new AuthError(undefined, 'No Authentication result received');
      // eslint-disable-next-line no-continue
      continue;
    }

    const { accessToken } = result;

    ghaCore.setOutput('access-token', accessToken);
    ghaCore.setOutput('result', result);
    return;
  }

  throw error;
}

async function run() {
  const msalHttpClient = new GhaHttpClient();
  try {
    await acquireAccessToken(msalHttpClient);
  } finally {
    msalHttpClient.dispose();
  }
}

run();
