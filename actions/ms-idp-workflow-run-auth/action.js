const ghaCore = require('@actions/core');
const { ClientAssertion, CryptoProvider } = require('@azure/msal-node');

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
    const spnUpdater = new GhaServicePrincipalUpdater(msalApp, clientId);
    try {
      keyCredential = await spnUpdater.addCertificateKeyCredential(keyPair);
    } finally {
      await spnUpdater.dispose();
    }
    saveState('key-credential-id', keyCredential?.keyId);

    ghaCore.info(
      'Waiting for 15 seconds for the certificate to propagate throughut the system.'
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 15000);
    });

    if (ghaCore.isDebug()) {
      const assertion = ClientAssertion.fromCertificate(
        keyPair.thumbprint.toString('hex'),
        keyPair.privateKey
      );
      const cryptoProvider = new CryptoProvider();
      const jwtString = assertion.getJwt(
        cryptoProvider,
        clientId,
        `${instance}/${tenantId}/oauth2/v2.0/token`
      );
      const [headerBase64, bodyBase64] = jwtString.split('.', 3);
      ghaCore.debug(
        `Certificate Assertion Header: ${Buffer.from(
          headerBase64 || '',
          'base64url'
        ).toString('utf-8')}`
      );
      ghaCore.debug(
        `Certificate Assertion Body: ${Buffer.from(
          bodyBase64 || '',
          'base64url'
        ).toString('utf-8')}`
      );
    }
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
