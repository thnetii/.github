const ghaCore = require('@actions/core');
const { LogLevel } = require('@azure/msal-node');

/** @type {import('@azure/msal-common').ILoggerCallback} */
function loggerCallback(level, message) {
  if (level === LogLevel.Error) ghaCore.error(message);
  else if (level === LogLevel.Warning) ghaCore.warning(message);
  else if (level === LogLevel.Info) ghaCore.info(message);
  else if (ghaCore.isDebug()) ghaCore.debug(message);
}

module.exports = {
  loggerOptions: /** @type {import('@azure/msal-common').LoggerOptions} */ ({
    loggerCallback,
    logLevel: ghaCore.isDebug() ? LogLevel.Verbose : LogLevel.Info,
    piiLoggingEnabled: false,
  }),
};
