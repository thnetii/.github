const ghaCore = require('@actions/core');
const {
  AzureCloudInstance,
  AuthError,
  buildAppConfiguration,
  ConfidentialClientApplication,
} = require('@azure/msal-node');

function getState() {
  const clientId = ghaCore.getState('client-id');
  const tenantId = ghaCore.getState('tenant-id');
  const instance =
    /** @type {AzureCloudInstance} */ (ghaCore.getState('instance')) ||
    AzureCloudInstance.AzurePublic;
  const idTokenAudience = ghaCore.getState('id-token-audience') || undefined;
  return {
    clientId,
    tenantId,
    instance,
    idTokenAudience,
  };
}

async function cleanup() {}

cleanup();
