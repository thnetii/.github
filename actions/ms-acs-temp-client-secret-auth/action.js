const ghaCore = require('@actions/core');
const {
  HttpClient,
  HttpClientError,
  HttpCodes,
} = require('@actions/http-client');
const { BearerCredentialHandler } = require('@actions/http-client/lib/auth');

const { getInput } = require('@thnetii/gh-actions-core-helpers');

/**
 * @param {HttpClient} httpClient
 * @param {string} clientId
 */
async function createServicePrincipalClientSecret(httpClient, clientId) {
  const addPasswordUrl = `https://graph.microsoft.com/v1.0/servicePrincipals(appId='${clientId}')/addPassword`;
  ghaCore.debug(
    'Executing Microsoft Graph REST API v1.0, servicePrincipal: addPassword'
  );
  ghaCore.debug(`Sending POST request to: ${addPasswordUrl}`);
  /**
   * @type {import('@actions/http-client/lib/interfaces').TypedResponse<{
   *  keyId: string;
   *  secretText: string;
   * }>}
   */
  const { result: clientSecretInfo, statusCode } = await httpClient.postJson(
    addPasswordUrl,
    {
      passwordCredential: {
        displayName: `GitHub Actions Temporary Client Secret`,
      },
    }
  );
  if (statusCode !== 200 || !clientSecretInfo)
    throw new HttpClientError(
      'Failed to add a client secret to service principal.',
      statusCode
    );
  const { keyId, secretText: clientSecret } = clientSecretInfo;
  ghaCore.debug(`Client secret created with keyId: ${keyId}`);
  ghaCore.debug(`Registering keyId for post-job cleanup.`);
  ghaCore.saveState('client-secret-key-id', keyId);
  ghaCore.setSecret(clientSecret);
  return clientSecretInfo;
}

/**
 * @param {HttpClient} httpClient
 * @param {string} instance
 * @param {string} tenantId
 */
async function getAcsMetadata(httpClient, instance, tenantId) {
  ghaCore.debug(
    `Requesting Azure ACS Metadata from IDP instance '${instance}' for realm '${tenantId}'`
  );
  const acsMetadataUrl = `${instance}/metadata/json/1?realm=${encodeURIComponent(
    tenantId
  )}`;
  /**
   * @type {import('@actions/http-client/lib/interfaces').TypedResponse<{
   *  keys: {
   *    usage: 'signing' | string;
   *    keyValue: {
   *      type: 'x509Certificate' | string;
   *      value: string;
   *      keyInfo: {
   *        x5t: string;
   *      }
   *    }
   *  }[];
   *  endpoints: {
   *    location: string;
   *    protocol: 'OAuth2' | 'DelegationIssuance1.0' | 'DelegationManagement1.0' | string;
   *    usage: 'issuance' | 'management' | string;
   *  }[];
   *  version: string;
   *  realm: string;
   *  name: string;
   *  allowedAudiences: string[];
   *  issuer: string;
   * }>}
   */
  const { statusCode, result: acsMetadata } = await httpClient.getJson(
    acsMetadataUrl
  );
  if (statusCode !== 200 || !acsMetadata)
    throw new HttpClientError(
      `Failed to acquire ACS Metadata Document for Realm: ${tenantId}`,
      statusCode
    );
  return acsMetadata;
}

/**
 * @param {HttpClient} httpClient
 * @param {string} tokenEndpoint
 * @param {string} realm
 * @param {string} clientId
 * @param {string} clientSecret
 * @param {string} resource
 */
async function getAcsAccessToken(
  httpClient,
  tokenEndpoint,
  realm,
  clientId,
  clientSecret,
  resource
) {
  ghaCore.debug(
    `Requesting access token for resource '${resource}' from token endpoint: ${tokenEndpoint}`
  );
  let requestBody = 'grant_type=client_credentials';
  requestBody += `&client_id=${encodeURIComponent(`${clientId}@${realm}`)}`;
  requestBody += `&client_secret=${encodeURIComponent(clientSecret)}`;
  requestBody += `&resource=${encodeURIComponent(resource)}`;
  const tokenResponse = await httpClient.post(tokenEndpoint, requestBody, {
    'Content-Type': 'application/x-www-form-urlencoded',
  });
  const {
    message: { statusCode = 500 },
  } = tokenResponse;
  /**
   * @type {{
   *  token_type: 'Bearer' | string;
   *  access_token: string;
   *  expires_in: number;
   *  expires_on: number;
   *  not_before: number;
   *  scope?: string;
   * }}
   */
  const authResult = JSON.parse(await tokenResponse.readBody());
  if (statusCode !== HttpCodes.OK)
    throw new HttpClientError(
      `Failed to acquire OAuth 2.0 Access Token from ACS Token Endpoint\n${JSON.stringify(
        authResult,
        undefined,
        2
      )}`,
      statusCode
    );
  const { access_token: acsAccessToken } = authResult;
  ghaCore.setSecret(acsAccessToken);
  const [, , signature] = acsAccessToken.split('.', 3);
  ghaCore.setSecret(signature || '');
  return authResult;
}

async function main() {
  const clientId = getInput('client-id', {
    required: true,
    trimWhitespace: true,
  });
  const tenantId = getInput('tenant-id', {
    required: true,
    trimWhitespace: true,
  });
  const idpInstance =
    getInput('instance', { required: false, trimWhitespace: true }) ||
    'https://login.microsoftonline.com';
  const msgraphAccessToken = getInput('msgraph-access-token', {
    required: true,
    trimWhitespace: true,
  });
  const acsResourceId =
    getInput('resource-id', { required: false, trimWhitespace: true }) ||
    clientId;
  const acsResourcePath = getInput('resource-path', {
    required: false,
    trimWhitespace: true,
  });
  const acsResource = acsResourcePath
    ? `${acsResourceId}/${acsResourcePath}@${tenantId}`
    : `${acsResourceId}@${tenantId}`;

  ghaCore.saveState('client-id', clientId);
  ghaCore.saveState('msgraph-access-token', msgraphAccessToken);

  const httpClient = new HttpClient();
  const graphClient = new HttpClient(undefined, [
    new BearerCredentialHandler(msgraphAccessToken),
  ]);
  try {
    const acsMetadata = await getAcsMetadata(httpClient, idpInstance, tenantId);
    const acsTokenEndpoint =
      acsMetadata.endpoints.filter(
        (endp) =>
          /^issuance$/iu.test(endp.usage) && /^OAuth2$/iu.test(endp.protocol)
      )[0]?.location ||
      `https://accounts.accesscontrol.windows.net/${tenantId}/tokens/OAuth/2`;
    const { secretText: clientSecret } =
      await createServicePrincipalClientSecret(graphClient, clientId);
    const { access_token: accessToken } = await getAcsAccessToken(
      httpClient,
      acsTokenEndpoint,
      tenantId,
      clientId,
      clientSecret,
      acsResource
    );
    ghaCore.setOutput('acs-access-token', accessToken);
  } finally {
    httpClient.dispose();
    graphClient.dispose();
  }
}

main();
