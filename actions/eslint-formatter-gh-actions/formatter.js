const ghaCore = require('@actions/core');
const ghaCommand = require('@actions/core/lib/command');
/** @type {import('eslint').ESLint.Formatter['format']} */
const stylish = require('eslint-formatter-stylish');

/** @type {{[s in import('eslint').Linter.Severity]: typeof ghaCore.error}} */
const severityCallback = {
  0: ghaCore.notice,
  1: ghaCore.warning,
  2: ghaCore.error,
};

/** @type {import('eslint').ESLint.Formatter['format']} */
module.exports = (results, data) => {
  ghaCommand.issueCommand('remove-matcher', { owner: 'eslint-stylish' }, '');
  for (const { filePath, messages } of results) {
    for (const {
      line,
      column,
      endLine,
      endColumn,
      severity,
      message: title,
      ruleId,
      fix,
      suggestions,
    } of messages) {
      const callback = severityCallback[severity];
      /** @type {ghaCore.AnnotationProperties} */
      const props = {
        file: filePath,
        title,
        startLine: line,
        startColumn: column,
        endLine,
        endColumn,
      };
      let message = title;
      if (ruleId) {
        message += ` eslint(${ruleId})`;
      }
      if (fix) {
        message += '\nPotentially fixable with the `--fix` option.';
      }
      if (suggestions) {
        message += '\nSuggestions:';
        for (const { messageId, desc } of suggestions) {
          message += '\n* ';
          if (messageId) {
            message += `${messageId}  \n  `;
          }
          message += desc;
        }
      }
      callback(message, props);
    }
  }
  return stylish(results, data);
};
