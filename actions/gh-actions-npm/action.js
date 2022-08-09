const ghaCore = require('@actions/core');
const { exec } = require('@actions/exec');
const {
  getInput,
  getMultilineInput,
} = require('@thnetii/gh-actions-core-helpers');

const regexErrorPattern = '^npm\\s+ERR!\\s+(.*)$';
const regexErrorMatcher = new RegExp(regexErrorPattern, 'u');
const regexWarningPattern = '^npm\\s+WARN\\s+(\\S+)\\s(.*)$';
const regexWarningMatcher = new RegExp(regexWarningPattern, 'u');

const npmArgs = getMultilineInput('arguments', { required: true });
const npmCwd = getInput('working-directory');

/**
 * @typedef {Object} BufferedMessage
 * @property {typeof ghaCore.error} callback
 * @property {string} message
 * @property {string} [code]
 * @property {import('@actions/core').AnnotationProperties} properties
 */
/** @type {BufferedMessage[]} */
const msgBuffer = [];

/** @param {string} line */
const tryGetErrorMatch = (line) => {
  const match = regexErrorMatcher.exec(line);
  if (!match) {
    return false;
  }
  const [message = '', title = ''] = match;
  msgBuffer.push({ callback: ghaCore.error, message, properties: { title } });
  return true;
};

/** @type {typeof tryGetErrorMatch} */
const tryGetWarningMatch = (line) => {
  const match = regexWarningMatcher.exec(line);
  if (!match) {
    return false;
  }
  const [message = '', code = '', title = ''] = match;
  msgBuffer.push({
    callback: ghaCore.warning,
    message,
    properties: {
      title,
    },
    code,
  });
  return true;
};

/** @see https://github.com/dword-design/package-name-regex/blob/658ce7a661512f3e1e5496d6eb1dfd5ec8ae65a1/src/index.js */
const npmPackageNameRegex =
  /(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*/;
const npmPackageNameRegexWithVersionAndColon = new RegExp(
  `^\\s*${npmPackageNameRegex.source}@\\S+:`,
  'u'
);

exec('npm', npmArgs, {
  cwd: npmCwd,
  ignoreReturnCode: true,
  listeners: {
    errline(line) {
      const handled = tryGetErrorMatch(line) || tryGetWarningMatch(line);
      if (handled) {
        /** Do nothing */
      }
    },
  },
}).then((exitCode) => {
  const reducedMsgBuffer = msgBuffer.reduce((acc, cur) => {
    const prv = acc[acc.length - 1];
    let merged = false;
    if (prv) {
      const {
        callback: prvCb,
        code: prvCode,
        properties: { title: prvTitle = '' },
      } = prv;
      const {
        callback: curCb,
        code: curCode,
        properties: { title: curTitle = '' },
      } = cur;
      if (prvCb === curCb && prvCode && curCode && prvCode === curCode) {
        if (
          npmPackageNameRegexWithVersionAndColon.test(prvTitle) &&
          !npmPackageNameRegexWithVersionAndColon.test(curTitle)
        ) {
          prv.properties.title += `\n${curTitle}`;
          prv.message += `\n${cur.message}`;
          merged = true;
        }
      }
    }
    if (!merged) {
      acc.push(cur);
    }
    return acc;
  }, /** @type {typeof msgBuffer} */ ([]));
  for (const { callback, message, properties } of reducedMsgBuffer) {
    callback(message, properties);
  }
  ghaCore.setOutput('npm-exitcode', exitCode);
  process.exitCode = exitCode;
});
