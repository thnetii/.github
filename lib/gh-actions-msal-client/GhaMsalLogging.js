import { error, warning, info, isDebug, debug } from '@actions/core';
import { LogLevel } from '@azure/msal-node';

/** @type {import('@azure/msal-common').ILoggerCallback} */
function loggerCallback(level, message) {
  if (level === LogLevel.Error) error(message);
  else if (level === LogLevel.Warning) warning(message);
  else if (level === LogLevel.Info) info(message);
  else if (isDebug()) debug(message);
}

/** @type {Required<Omit<import('@azure/msal-common').LoggerOptions, 'correlationId'>>} */
export default {
  loggerCallback,
  logLevel: isDebug() ? LogLevel.Verbose : LogLevel.Info,
  piiLoggingEnabled: false,
};
