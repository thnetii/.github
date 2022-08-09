const path = require('path');
const ghaCore = require('@actions/core');
const ghaCommand = require('@actions/core/lib/command');
const { exec } = require('@actions/exec');
const tscJson = require('setup-node/.github/tsc.json');
const {
  getInput,
  getMultilineInput,
  getNpmExecArguments,
} = require('@thnetii/gh-actions-core-helpers');

const tscProblemMatcherDef = tscJson.problemMatcher.find(
  (m) => m.owner === 'tsc'
);
const tscProblemMatcherPattern = tscProblemMatcherDef?.pattern[0];
if (!tscProblemMatcherDef || !tscProblemMatcherPattern) {
  throw new TypeError(
    "TypeScript problem matcher from 'actions/setup-node' not available."
  );
}
const tscProblemRegExp = new RegExp(tscProblemMatcherPattern.regexp, 'u');
ghaCommand.issueCommand(
  'remove-matcher',
  { owner: tscProblemMatcherDef.owner },
  ''
);
const tscShortRegExp = /^(error|warning|info)\s+TS(\d+)\s*:\s*(.*)$/u;

const tscArgs = getMultilineInput('arguments', { required: true });
const tscCwd = getInput('working-directory');
const githubWorkspace = getInput('github-workspace') || process.cwd();
const npmExecArgs = getNpmExecArguments();
npmExecArgs.push('--', 'tsc', ...tscArgs);
const tscfilePrefix = path.relative(githubWorkspace, path.resolve(tscCwd));

/**
 * @param {string} line
 */
const getTscFullRegexInfo = (line) => {
  const tscProblemMatch = tscProblemRegExp.exec(line);
  if (!tscProblemMatch) return false;
  const title = tscProblemMatch[tscProblemMatcherPattern.message] || '';
  const code = tscProblemMatch[tscProblemMatcherPattern.code];
  const severity = tscProblemMatch[tscProblemMatcherPattern.severity] || '';
  const lineNumberString = tscProblemMatch[tscProblemMatcherPattern.line];
  const columnNumberString = tscProblemMatch[tscProblemMatcherPattern.column];
  const fileString = tscProblemMatch[tscProblemMatcherPattern.file];
  const fileFullPath = path.join(tscfilePrefix, fileString || '.');
  /** @type {import('@actions/core').AnnotationProperties} */
  const props = { title, file: fileFullPath };
  if (lineNumberString) {
    const lineNumber = parseInt(lineNumberString, 10);
    if (!Number.isNaN(lineNumber)) {
      props.startLine = lineNumber;
    }
    if (columnNumberString) {
      const columnNumber = parseInt(columnNumberString, 10);
      if (!Number.isNaN(columnNumber)) {
        props.startColumn = columnNumber;
      }
    }
  }
  return { code, severity, props };
};

/** @type {typeof getTscFullRegexInfo} */
const getTscShortRegexInfo = (line) => {
  const tscOutputMatch = tscShortRegExp.exec(line);
  if (!tscOutputMatch) return false;
  const [, severity = '', code, title = ''] = tscOutputMatch;
  /** @type {import('@actions/core').AnnotationProperties} */
  const props = { title };
  return { code, severity, props };
};

exec('npm', npmExecArgs, {
  cwd: tscCwd,
  ignoreReturnCode: true,
  listeners: {
    stdline(line) {
      const info = getTscFullRegexInfo(line) || getTscShortRegexInfo(line);
      if (!info) return;
      const {
        severity,
        code,
        props,
        props: { title },
      } = info;
      const message = `TS${code}: ${title}`;
      if (/^error$/iu.test(severity)) {
        ghaCore.error(message, props);
      } else if (/^warning$/iu.test(severity)) {
        ghaCore.warning(message, props);
      } else {
        ghaCore.notice(message, props);
      }
    },
  },
}).then((exitCode) => {
  ghaCore.setOutput('tsc-exitcode', exitCode);
  process.exitCode = exitCode;
});
