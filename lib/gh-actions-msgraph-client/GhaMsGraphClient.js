const { Client } = require('@microsoft/microsoft-graph-client');

const { GhaHttpMessageHandler } = require('./GhaHttpMessageHandler');

module.exports = {
  /**
   * @param {import('@actions/http-client').HttpClient} httpClient
   */
  initGithubActions(httpClient) {
    return Client.initWithMiddleware({
      middleware: [new GhaHttpMessageHandler(httpClient)],
    });
  },
};
