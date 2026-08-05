// Test harness: stub browser DOM, load index.html script, exercise generators
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace('"use strict";', ''); // non-strict eval so function decls leak to test scope

function makeEl() {
  return {
    className: '', textContent: '', innerHTML: '', value: '', disabled: false,
    placeholder: '', onclick: null, addEventListener() {}, appendChild() {}, focus() {}, select() {},
    classList: { toggle() {}, remove() {}, add() {} },
    style: {},
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
// ---- divisibility: true/false with all accepted word forms ----
const TRUE_WORDS = ['true', 'yes', 'y', 't', '1'];
const FALSE_WORDS = ['false', 'no', 'n', 'f', '0'];
let trueSeen = 0, falseSeen = 0;
for (let i = 0; i < 400; i++) {
  const g = genDivisible(diff);
  const m = g.q.match(/Is (\d+) divisible by (\d+)\?/);
  const z = Number(m[1]), y = Number(m[2]);
  const actually = z % y === 0;
  if (actually !== g.expected) failures.push(`div: expected mismatch ${g.q} -> ${g.expected}`);
  if (y < 2 || z < y) failures.push(`div: bad numbers ${g.q}`);
  // every accepted form must agree
  const words = g.expected ? TRUE_WORDS : FALSE_WORDS;
  const wrongWords = g.expected ? FALSE_WORDS : TRUE_WORDS;
  for (const w of words) if (!g.check(w)) failures.push(`div rejected "${w}" for ${g.q} (expected ${g.expected})`);
  for (const w of wrongWords) if (g.check(w)) failures.push(`div accepted wrong "${w}" for ${g.q} (expected ${g.expected})`);
  if (g.check('maybe')) failures.push(`div accepted junk "maybe" for ${g.q}`);
  g.expected ? trueSeen++ : falseSeen++;
}
if (!trueSeen || !falseSeen) failures.push(`div: only ${trueSeen} true / ${falseSeen} false cases — need both`);
console.log(`  divisibility: ${trueSeen} true / ${falseSeen} false questions`);
// ---- divisor range toggle: divisor obeys its cap independently of diff ----
const DIV_CAP_TESTS = { small: 5, med: 12, large: 20 };
let divRangeFail = 0;
for (const [divRange, dcap] of Object.entries(DIV_CAP_TESTS)) {
  els['divrange'].value = divRange;
  for (let i = 0; i < 120; i++) {
    const d = genDivisible('hard'); // hardest diff to force y up toward cap
    const dyy = Number(d.q.match(/by (\d+)\?/)[1]);
    if (dyy < 2 || dyy > dcap) { divRangeFail++; failures.push(`divisors: y=${dyy} exceeds ${divRange} cap ${dcap}`); }
  }
}
els['divrange'].value = 'med';
if (divRangeFail) failures.push(`divisors toggle: ${divRangeFail} violations`);
// ---- ranges ----
for (let i = 0; i < 300; i++) {
  const g = genFactoring('hard');
  const n = parseInt(g.q.replace(/\D/g, ''));
  if (n > 2000) failures.push(`factoring hard n=${n} exceeds 2000`);
}

console.log(failures.length === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failures.length} FAILURES`);
failures.slice(0, 10).forEach(f => console.log('  -', f));

// ---- Mixed mode: every question must be answerable + all 4 kinds appear ----
const kinds = new Set();
let mixedFail = 0;
for (let i = 0; i < 600; i++) {
  const g = genMixed('med');
  kinds.add(g.kind);
  if (g.kind === 'fact') {
    const entries = Object.entries(g.expected).sort((a, b) => a[0] - b[0]);
    const f = entries.map(([p, e]) => e === 1 ? `${p}` : `${p}^${e}`).join('*');
    if (!g.check(f)) mixedFail++;
  } else {
    if (!g.check(String(g.expected))) mixedFail++;
  }
}
if (mixedFail) failures.push(`mixed: ${mixedFail} unanswerable questions`);
if (kinds.size !== 5) failures.push(`mixed: only saw kinds ${[...kinds]}`);
console.log(kinds.size === 5 ? `  mixed mode produced all 5 kinds: ${[...kinds].join(', ')}` : `  ✗ mixed kinds: ${[...kinds]}`);
console.log(failures.length === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failures.length} FAILURES`);
failures.slice(0, 5).forEach(f => console.log('  -', f));

// ---- Combo mode: subset selection via window.setComboKinds ----
window.setComboKinds(['fact', 'ncr']);
let comboSeen = new Set(), comboFail = 0;
for (let i = 0; i < 300; i++) {
  const g = genCombo('med');
  comboSeen.add(g.kind);
  if (!['fact', 'ncr'].includes(g.kind)) comboFail++;
  if (g.kind === 'fact') {
    const entries = Object.entries(g.expected).sort((a, b) => a[0] - b[0]);
    const f = entries.map(([p, e]) => e === 1 ? `${p}` : `${p}^${e}`).join('*');
    if (!g.check(f)) comboFail++;
  } else if (!g.check(String(g.expected))) comboFail++;
}
if ([...comboSeen].some(k => !['fact', 'ncr'].includes(k))) failures.push(`combo leaked kinds: ${[...comboSeen]}`);
if (comboFail) failures.push(`combo: ${comboFail} answerable failures`);
window.setComboKinds(['arith']);
const gSingle = genCombo('med');
if (gSingle.kind !== 'arith') failures.push(`combo single-kind: got ${gSingle.kind}`);
console.log(`  combo subset (fact+ncr) produced: ${[...comboSeen].join(', ')}`);
console.log(failures.length === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failures.length} FAILURES`);
failures.slice(0, 5).forEach(f => console.log('  -', f));

// ---- Range filter: all generators respect the cap ----
const RANGE_TESTS = { small: 30, med: 100, large: 1000, huge: 10000 };
let rangeFail = 0;
for (const [range, cap] of Object.entries(RANGE_TESTS)) {
  els['range'].value = range;
  for (let i = 0; i < 150; i++) {
    const a = genArithmetic('med');
    if (a.expected > cap) { rangeFail++; failures.push(`arith ${a.q} = ${a.expected} exceeds ${range} cap`); }
    const e = genExponents('med');
    if (e.expected > cap) { rangeFail++; failures.push(`exp ${e.q} = ${e.expected} exceeds ${range} cap`); }
    const f = genFactoring('med');
    const n = parseInt(f.q.replace(/\D/g, ''));
    if (n > cap || n < 12) { rangeFail++; failures.push(`fact ${f.q} outside [12,${cap}]`); }
    const c = genNCR('med');
    const m = c.q.match(/C\((\d+),/);
    if (m && Number(m[1]) > ({ small: 8, med: 12, large: 16, huge: 20 })[range]) { rangeFail++; failures.push(`ncr ${c.q} n too big for ${range}`); }
    const d = genDivisible('med');
    const dz = Number(d.q.match(/Is (\d+)/)[1]);
    if (dz > cap) { rangeFail++; failures.push(`div ${d.q} exceeds ${range} cap`); }
  }
}
els['range'].value = 'med'; // restore default
console.log(`  range filter tested across ${Object.keys(RANGE_TESTS).length} ranges`);

// ---- Dynamic factoring: variety + repeat guard ----
const factSeen = new Set();
els['range'].value = 'huge'; // big space = real variety test
for (let i = 0; i < 200; i++) {
  const f = genFactoring('hard');
  const n = parseInt(f.q.replace(/\D/g, ''));
  if (Object.keys(f.expected).length < 2) { rangeFail++; failures.push(`factoring ${f.q} has <2 prime factors`); }
  if (n > 10000 || n < 12) { rangeFail++; failures.push(`factoring ${f.q} outside [12,10000]`); }
  factSeen.add(n);
}
els['range'].value = 'med'; // restore default
console.log(`  dynamic factoring variety (200 hard questions @huge range): ${factSeen.size} distinct numbers`);
if (factSeen.size < 100) failures.push(`factoring too repetitive: only ${factSeen.size} distinct numbers`);

if (rangeFail) failures.push(`range: ${rangeFail} violations`);
console.log(failures.length === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failures.length} FAILURES`);
failures.slice(0, 8).forEach(f => console.log('  -', f));

// ---- Retry-until-correct flow ----
global.setTimeout = () => {}; // stop auto-advance mid-test
const retryEl = els['answer'];
const q1 = window.__current();
retryEl.value = '0'; // guaranteed wrong
submit();
if (retryEl.disabled) failures.push('retry: input disabled after wrong answer');
if (els['feedback'].textContent !== '✗ try again') failures.push(`retry: wrong feedback "${els['feedback'].textContent}"`);
if (window.__current() !== q1) failures.push('retry: advanced after wrong answer');
if (els['streak'].textContent !== 0) failures.push('retry: streak not reset on wrong');
retryEl.value = String(q1.expected);
submit(); // correct on 2nd try
if (els['feedback'].className !== 'feedback correct') failures.push('retry: not marked correct after retry');
if (els['correct'].textContent !== 1) failures.push(`retry: correct counter = ${els['correct'].textContent}`);
if (els['asked'].textContent !== 1) failures.push(`retry: asked should count once, got ${els['asked'].textContent}`);
if (els['streak'].textContent !== 0) failures.push('retry: streak should stay 0 (answered on 2nd try)');
const triesText = els['feedback'].textContent;
if (!triesText.includes('2 tries')) failures.push(`retry: expected "2 tries" note, got "${triesText}"`);
console.log('  retry-until-correct flow verified');
console.log(failures.length === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failures.length} FAILURES`);
failures.slice(0, 6).forEach(f => console.log('  -', f));
