const fs = require('fs');
const src = fs.readFileSync('public/_worker.js', 'utf8');

function grab(name) {
  const i = src.indexOf('function ' + name);
  if (i < 0) throw new Error('not found ' + name);
  const open = src.indexOf('{', i);
  let depth = 0, inStr = null, esc = 0;
  for (let k = open; k < src.length; k++) {
    const c = src[k];
    if (inStr) { if (esc) { esc = 0; continue; } if (c === '\\') { esc = 1; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(i, k + 1); }
  }
  throw new Error('fail ' + name);
}

let code = ['estimateTokensForText', 'estimateMessagesTokens', 'buildCompactionSummary', 'applyContextBudgetToMessages']
  .map(grab).join('\n');
code += `
const AGENT_CONTEXT_BUDGET_TOKENS=60000, AGENT_COMPACT_THRESHOLD_RATIO=0.8, AGENT_RETAIN_RATIO=0.16;
const PRUNE_MARKER='[x]';
const COMPACT_SUMMARY_TAG='compacted-summary';
const msgs=[]; for(let i=0;i<50;i++) msgs.push({role:i%2?'assistant':'user',content:'历史内容'.repeat(200)});
const before=estimateMessagesTokens(msgs,'sys'.repeat(500),[]);
const out=applyContextBudgetToMessages(msgs,'sys'.repeat(500),[]);
console.log('before tokens:',before,'threshold:',Math.floor(60000*0.8));
console.log('in count:',msgs.length,'-> out count:',out.length);
console.log('has summary:',out.some(m=>String(m.content||'').includes('compacted-summary')));
console.log('out lens:',out.map(m=>String(m.content||'').length));
`;
eval(code);