const fs = require('node:fs');
const { Linter } = require('eslint');
// Check the actual inline production scripts as well as the standalone exporter.
// Legacy globals are shared between script tags; this deliberately focuses on
// control-flow and expression errors rather than renaming or formatting old code.
const config = {
  languageOptions: { ecmaVersion: 'latest', sourceType: 'script' },
  rules: {
    'constructor-super': 'error', 'for-direction': 'error',
    'getter-return': 'error', 'no-async-promise-executor': 'error',
    'no-compare-neg-zero': 'error', 'no-cond-assign': ['error', 'except-parens'],
    'no-const-assign': 'error', 'no-dupe-args': 'error', 'no-dupe-else-if': 'error',
    'no-duplicate-case': 'error', 'no-func-assign': 'error', 'no-promise-executor-return': 'error',
    'no-self-assign': 'error', 'no-setter-return': 'error', 'no-unexpected-multiline': 'error',
    'no-unreachable': 'error', 'no-unsafe-finally': 'error', 'no-unsafe-optional-chaining': 'error',
    'use-isnan': 'error', 'valid-typeof': 'error'
  }
};
const linter = new Linter();
const scripts = [...fs.readFileSync('index.html', 'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(m => !/\bsrc=/.test(m[1])).map((m, i) => [`index.html script ${i + 1}`, m[2]]);
scripts.push(['media-export.js', fs.readFileSync('media-export.js', 'utf8')]);

let count = 0;
for (const [name, code] of scripts) {
  // The legacy single-file app retains disabled implementations after early
  // returns. Keep those paths intact; all other rules still cover every script.
  const applicable = name.startsWith('index.html') ? { ...config, linterOptions: { reportUnusedDisableDirectives: false }, rules: { ...config.rules, 'no-unreachable': 'off' } } : config;
  const issues = linter.verify(code, applicable);
  for (const issue of issues) console.error(`${name}:${issue.line}:${issue.column} ${issue.message} (${issue.ruleId})`);
  count += issues.length;
}
if (count) process.exitCode = 1;
else console.log(`Lint passed for ${scripts.length} production scripts`);
