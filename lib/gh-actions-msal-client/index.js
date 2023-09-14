/* eslint-disable import/prefer-default-export */

import { GhaHttpClient } from '@thnetii/gh-actions-http-client';

import loggerOptions from './GhaMsalLogging.js';
import GhaMsalNetworkModule from './GhaMsalNetworkModule.js';

/**
 * @typedef {Required<Pick<T, K>> & Omit<T, K>} RequiredProperty
 * @template T
 * @template {keyof T} K
 */

/**
 * @param {import('@actions/http-client').HttpClient | undefined} [httpClient]
 * @returns {RequiredProperty<import('@azure/msal-node').NodeSystemOptions, 'loggerOptions' | 'networkClient'>}
 */
export function buildNodeSystemOptions(httpClient) {
  // eslint-disable-next-line no-param-reassign
  httpClient = httpClient || new GhaHttpClient();
  return {
    loggerOptions,
    networkClient: new GhaMsalNetworkModule(httpClient),
  };
}
