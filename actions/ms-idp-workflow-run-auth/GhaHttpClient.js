const ghaCore = require('@actions/core');
const { HttpClient } = require('@actions/http-client');

class GhaHttpClient extends HttpClient {
  /**
   * @override
   * @type {HttpClient['requestRaw']}
   */
  async requestRaw(info, data) {
    if (ghaCore.isDebug())
      ghaCore.debug(`--> ${info.options.method} ${info.parsedUrl}`);
    const resp = await super.requestRaw(info, data);
    if (ghaCore.isDebug())
      ghaCore.debug(
        `<-- HTTP/${resp.message.httpVersion} ${resp.message.statusCode} ${resp.message.statusMessage}`
      );
    return resp;
  }
}

module.exports = {
  GhaHttpClient,
};