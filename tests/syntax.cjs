const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
let count = 0;
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (/\bsrc=/.test(match[1])) continue;
  new vm.Script(match[2], { filename: `index.html inline script ${++count}` });
}
console.log(`Parsed ${count} inline scripts`);
