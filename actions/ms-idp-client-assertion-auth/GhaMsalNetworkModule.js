const { HttpClient, HttpClientError } = require('@actions/http-client');

/** @typedef {import('@azure/msal-common').INetworkModule} INetworkModule */

/**
 * @param {import('@actions/http-client/lib/interfaces').TypedResponse<T>} httpResp
 * @returns {import('@azure/msal-common').NetworkResponse<T>}
 * @template T
 */
function toNetworkResponse(httpResp) {
  if (httpResp.result === null)
    throw new HttpClientError(
      'Deserialized JSON response response payload is null.',
      httpResp.statusCode
    );
  const headers = Object.fromEntries(
    Object.entries(httpResp.headers).map(([header, value]) => {
      if (typeof value === 'string') return [header, value];
      if (Array.isArray(value)) return [header, value.join('\n')];
      return [header, ''];
    })
  );
  return {
    status: httpResp.statusCode,
    body: httpResp.result,
    headers,
  };
}

/** @implements INetworkModule */
class GhaMsalNetworkModule {
  constructor() {
    this.httpClient = new HttpClient();
  }

  /**
   * @param {string} url
   * @param {import('@azure/msal-common').NetworkRequestOptions | undefined} [options]
   * @template T
   */
  async sendGetRequestAsync(url, options) {
    /** @type {import('@actions/http-client/lib/interfaces').TypedResponse<T>} */
    const resp = await this.httpClient.getJson(url, options?.headers);
    return toNetworkResponse(resp);
  }

  /**
   * @param {string} url
   * @param {import('@azure/msal-common').NetworkRequestOptions | undefined} [options]
   * @template T
   */
  async sendPostRequestAsync(url, options) {
    /** @type {import('@actions/http-client/lib/interfaces').TypedResponse<T>} */
    const resp = await this.httpClient.postJson(
      url,
      options?.body,
      options?.headers
    );
    return toNetworkResponse(resp);
  }
}

module.exports = {
  GhaMsalNetworkModule,
};
