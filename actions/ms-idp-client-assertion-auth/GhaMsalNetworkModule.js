const { HttpClient, HttpClientError } = require('@actions/http-client');

/** @typedef {import('@azure/msal-common').INetworkModule} INetworkModule */

/**
 * @param {import('@actions/http-client').HttpClientResponse['message']['headers']} headers
 */
function simplifyHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([header, value]) => {
      if (typeof value === 'string') return [header, value];
      if (Array.isArray(value)) return [header, value.join('\n')];
      return [header, ''];
    })
  );
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
    if (resp.result === null)
      throw new HttpClientError('HTTP result object is null', resp.statusCode);
    return {
      status: resp.statusCode,
      body: resp.result,
      headers: simplifyHeaders(resp.headers),
    };
  }

  /**
   * @type {INetworkModule['sendPostRequestAsync']}
   */
  async sendPostRequestAsync(url, options) {
    const resp = await this.httpClient.post(
      url,
      options?.body || '',
      options?.headers
    );
    const msg = resp.message;
    const bodyString = await resp.readBody();
    return {
      status: msg.statusCode || 200,
      body: JSON.parse(bodyString),
      headers: simplifyHeaders(msg.headers),
    };
  }
}

module.exports = {
  GhaMsalNetworkModule,
};
