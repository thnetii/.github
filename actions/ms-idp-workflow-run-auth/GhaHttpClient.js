const ghaCore = require('@actions/core');
const ghaCommand = require('@actions/core/lib/command');
const { HttpClient } = require('@actions/http-client');

class GhaHttpClient extends HttpClient {
  /**
   * @override
   * @type {HttpClient['requestRaw']}
   */
  async requestRaw(info, data) {
    ghaCommand.issue('command', `${info.options.method} ${info.parsedUrl}`);
    const resp = await super.requestRaw(info, data);
    ghaCore.debug(
      `HTTP/${resp.message.httpVersion} ${resp.message.statusCode} ${resp.message.statusMessage}`
    );
    return resp;
  }
}

module.exports = {
  GhaHttpClient,
};
