import { info, getIDToken, setSecret, isDebug, debug } from '@actions/core';
import { AzureCloudInstance } from '@azure/msal-node';

import { getInput } from '@thnetii/gh-actions-core-helpers';

export function getActionInputs() {
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
  const authMethod =
    /** @type {import('./types.d.ts').GhaActionAuthMethod} */ (
      getInput('auth-method', {
        required: false,
        trimWhitespace: true,
      })
    ) || 'ms-idp-federated-credential';
  return {
    clientId,
    tenantId,
    instance,
    resource,
    idTokenAudience,
    authMethod,
  };
}

/**
 * @param {string | undefined} [audience]
 */
export async function getGithubActionsToken(audience) {
  info(`Requesting GitHub Actions ID token for audience: '${audience}'`);
  const idToken = await getIDToken(audience);
  return idToken;
}

/** @param {string} token */
export function onJwtToken(token) {
  if (!token) return;
  setSecret(token);
  const [, body, signature] = token.split('.', 3);
  // Special protection for the token signature.
  // Without it the rest of the token is safe to be displayed.
  if (signature) setSecret(signature);
  if (isDebug()) {
    if (body) {
      try {
        const bodyDecoded = Buffer.from(body, 'base64url').toString('utf-8');
        debug(`JWT: ${bodyDecoded}`);
      } catch {
        debug(`JWT-ish (body is not Base64 encoded): ${body}`);
      }
    } else {
      debug('Non JWT received.');
    }
  }
}
