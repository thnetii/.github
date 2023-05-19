/** @typedef {import('@microsoft/microsoft-graph-client').Middleware} Middleware */

const httpClientSym = Symbol('#httpClient');

/** @implements Middleware */
class GhaMsGraphHttpMessageHandler {
  /**
   * @param {import('@actions/http-client').HttpClient} httpClient
   */
  constructor(httpClient) {
    this[httpClientSym] = httpClient;
  }

  /** @type {Middleware['execute']} */
  async execute(context) {
    const httpClient = this[httpClientSym];

    const resp = await httpClient.request(verb, requUrl, requData, requHeaders);
  }
}
