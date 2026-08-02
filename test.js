// Test harness: stub browser DOM, load index.html script, exercise generators
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEl() {
  return {
    className: '', textContent: '', innerHTML: '', value: '', disabled: false,
    placeholder: '', onclick: null, addEventListener() {}, appendChild() {}, focus() {},
  };
}
const els = {};
global.document = {
  getElementById: id => (els[id] = els[id] || makeEl()),
  createElement: () => makeEl(),
  querySelectorAll: () => [],
};
global.window = {};
eval(script);

// the script ran next() once; grab a fresh question each iteration
const diff = 'med';
let failures = [];

// ---- arithmetic ----
for (let i = 0; i < 400; i++) {
  const g = genArithmetic(diff);
  const ans = String(g.expected);
  if (!g.check(ans)) failures.push(`arith rejected ${g.q} = ${ans}`);
  if (g.check(ans + 'x')) failures.push(`arith accepted junk for ${g.q}`);
}
// ---- exponents ----
for (let i = 0; i < 400; i++) {
  const g = genExponents(diff);
  const ans = String(g.expected);
  if (!g.check(ans)) failures.push(`exp rejected ${g.q} = ${ans}`);
}
// ---- nCr ----
for (let i = 0; i < 400; i++) {
  const g = genNCR(diff);
  const ans = String(g.expected);
  if (!g.check(ans)) failures.push(`ncr rejected ${g.q} = ${ans}`);
  if (isNaN(g.expected)) failures.push(`ncr NaN for ${g.q}`);
}
// ---- factoring: exact + alternate formats ----
for (let i = 0; i < 400; i++) {
  const g = genFactoring(diff);
  const entries = Object.entries(g.expected).sort((a, b) => a[0] - b[0]);
  const fmt1 = entries.map(([p, e]) => e === 1 ? `${p}` : `${p}^${e}`).join('*');
  const fmt2 = entries.map(([p, e]) => Array(e).fill(p).join('x')).join('x');
  const fmt3 = entries.map(([p, e]) => `${p}^${e}`).join(' x ');
  for (const f of [fmt1, fmt2, fmt3]) {
    if (!g.check(f)) failures.push(`factoring rejected ${g.q} fmt "${f}" (expected ${g.key})`);
  }
  if (g.check('5')) failures.push(`factoring accepted wrong answer for ${g.q}`);
}
// ---- factoring easy: ensure 2+ distinct primes kept ----
for (let i = 0; i < 200; i++) {
  const g = genFactoring('easy');
  if (Object.keys(g.expected).length < 2) failures.push(`factoring easy produced single-prime ${g.q}`);
}
// ---- ranges ----
for (let i = 0; i < 300; i++) {
  const g = genFactoring('hard');
  const n = parseInt(g.q.replace(/\D/g, ''));
  if (n > 2000) failures.push(`factoring hard n=${n} exceeds 2000`);
}

console.log(failures.length === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failures.length} FAILURES`);
failures.slice(0, 10).forEach(f => console.log('  -', f));
