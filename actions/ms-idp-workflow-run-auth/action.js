const ghaCore = require('@actions/core');
const { AzureCloudInstance } = require('@azure/msal-node');

const { getInput } = require('@thnetii/gh-actions-core-helpers');

const { GhaHttpClient } = require('@thnetii/gh-actions-http-client');

const { getGithubActionsToken } = require('./utils');
const { GhaMsalAccessTokenProvider } = require('./GhaMsalAccessTokenProvider');
const { generateCertificate } = require('./GhaOpenSslCertProvider');
const { GhaServicePrincipalUpdater } = require('./GhaServicePrincipalUpdater');

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
  let useClientCertificate;
  try {
    useClientCertificate = JSON.parse(
      getInput('use-client-certificate', {
        required: false,
        trimWhitespace: true,
      }) || 'false'
    );
  } finally {
    if (typeof useClientCertificate !== 'boolean') {
      ghaCore.error(
        `Invalid input for 'use-client-certificate'. Input value is not a boolean JSON value.`
      );
    }
    useClientCertificate = false;
  }
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
    useClientCertificate,
  };
}

/**
 * @param {import('@actions/http-client').HttpClient} httpClient
 */
async function acquireAccessToken(httpClient) {
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
    const keyPair = await generateCertificate();
    let keyCredential;
    const spnUpdater = new GhaServicePrincipalUpdater(
      msalApp.msalApp,
      clientId
    );
    try {
      keyCredential = await spnUpdater.addCertificateKeyCredential(keyPair);
    } finally {
      spnUpdater.dispose();
    }
    ghaCore.saveState('keyCredential-keyId', keyCredential?.keyId || '');

    msalApp = new GhaMsalAccessTokenProvider(
      httpClient,
      clientId,
      {
        privateKey: keyPair.privateKey,
        thumbprint: keyPair.x509.fingerprint256,
        x5c: keyPair.certificate,
      },
      tenantId,
      instance
    );
  }

  const result = await msalApp.acquireAccessToken(resource);
  const { accessToken } = result;

  ghaCore.setOutput('access-token', accessToken);
  ghaCore.setOutput('result', result);
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
