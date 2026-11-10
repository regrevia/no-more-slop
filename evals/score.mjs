#!/usr/bin/env node
// 中文界面文案判分器：对「候选文案」按 case 的机器判据打分。
// 用法：
//   node evals/score.mjs --cases evals/cases.jsonl --bad                # 坏样本必须 FAIL
//   node evals/score.mjs --cases evals/cases.jsonl --outputs out.json   # 判分模型产出
//   node evals/score.mjs --cases evals/cases.jsonl --outputs out.json --min-pass 0.9 --json
// outputs 形态：{"<id>": ["行1","行2"]} 或 [{"id":"...","lines":[...]}] 或 {"<id>":{"lines":[...]}}
// 退出码：0 达到阈值；1 未达标或参数错误。

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? true) : def;
};
const flag = (name) => args.includes(`--${name}`);

const casesPath = opt('cases');
if (!casesPath) {
  console.error('需要 --cases <cases.jsonl>');
  process.exit(1);
}
const minPass = Number(opt('min-pass', flag('bad') ? 1 : 0.9));
const json = flag('json');

const CJK = /[\u3400-\u9fff]/gu;
const cjkLen = (s) => (s.match(CJK) || []).length;
const PROSE_MIN = 24;

const loadCases = (p) =>
  fs.readFileSync(p, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      try { return JSON.parse(l); } catch (e) {
        console.error(`cases 第 ${i + 1} 行不是合法 JSON: ${e.message}`);
        process.exit(1);
      }
    });

const toLines = (v) => {
  if (!v) return null;
  if (Array.isArray(v)) return v.map(String);
  if (Array.isArray(v.lines)) return v.lines.map(String);
  if (typeof v === 'string') return v.split('\n');
  return null;
};

const loadOutputs = (p) => {
  if (!p) return null;
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const map = new Map();
  if (Array.isArray(raw)) {
    for (const it of raw) {
      const lines = toLines(it);
      if (it && it.id && lines) map.set(it.id, lines);
    }
  } else {
    for (const [k, v] of Object.entries(raw)) {
      const lines = toLines(v);
      if (lines) map.set(k, lines);
    }
  }
  return map;
};

const matches = (hay, pat) => {
  try {
    if (pat.startsWith('/') && pat.lastIndexOf('/') > 0) {
      const body = pat.slice(1, pat.lastIndexOf('/'));
      const fl = pat.slice(pat.lastIndexOf('/') + 1);
      return new RegExp(body, fl).test(hay);
    }
    return hay.includes(pat);
  } catch {
    return hay.includes(pat);
  }
};

const score = (c, lines) => {
  const fails = [];
  if (!lines || lines.length === 0) return ['empty'];
  const text = lines.join('\n');
  for (const p of c.must_absent || []) if (matches(text, p)) fails.push(`forbidden:${p}`);
  for (const p of c.must_present || []) if (!matches(text, p)) fails.push(`missing:${p}`);
  const max = Number(c.max_chars_per_line || 24);
  for (const ln of lines) {
    const n = cjkLen(ln);
    if (n > max) fails.push(`long-line:${n}>${max}`);
    if (n >= PROSE_MIN && /[。；]/.test(ln)) fails.push('prose-block');
  }
  if (c.expect_one_primary && lines.every((l) => !/\b主\b|primary/i.test(l))) {
    // 只有候选没标注主次时提示；不作为硬失败
    fails.push('warn:no-primary-marker');
  }
  return fails;
};

const cases = loadCases(casesPath);
const outputs = loadOutputs(opt('outputs'));
const rows = [];
let pass = 0;
let total = 0;

for (const c of cases) {
  let lines;
  if (outputs) {
    lines = outputs.get(c.id);
    if (!lines) { rows.push({ id: c.id, status: 'skip', fails: ['no-output'] }); continue; }
    total += 1;
    const fails = score(c, lines);
    const ok = fails.filter((f) => !f.startsWith('warn:')).length === 0;
    if (ok) pass += 1;
    rows.push({ id: c.id, status: ok ? 'pass' : 'fail', fails });
  } else if (flag('bad')) {
    const badLines = toLines(c.bad_sample);
    if (!badLines) { rows.push({ id: c.id, status: 'skip', fails: ['no-bad-sample'] }); continue; }
    total += 1;
    const fails = score(c, badLines);
    const caught = fails.filter((f) => !f.startsWith('warn:'));
    // 坏样本必须被抓住：至少 2 条硬失败（判据不是"能抓一条就行"）
    const ok = caught.length >= 2;
    if (ok) pass += 1;
    rows.push({ id: c.id, status: ok ? 'caught' : 'MISSED', caught: caught.length, fails });
  } else if (flag('good')) {
    const lines = toLines(c.good_sample);
    if (!lines) { rows.push({ id: c.id, status: 'skip', fails: ['no-good-sample'] }); continue; }
    total += 1;
    const fails = score(c, lines).filter((f) => !f.startsWith('warn:'));
    if (fails.length === 0) pass += 1;
    rows.push({ id: c.id, status: fails.length ? 'FALSE-POSITIVE' : 'pass', fails });
  }
}

const rate = total ? pass / total : 0;
const ruleHits = {};
for (const r of rows) for (const f of r.fails || []) {
  const k = f.split(':')[0];
  ruleHits[k] = (ruleHits[k] || 0) + 1;
}

if (json) {
  console.log(JSON.stringify({ pass, total, rate, ruleHits, rows }, null, 2));
} else {
  for (const r of rows) {
    if (r.status === 'pass' || r.status === 'caught') continue;
    console.log(`${r.status.padEnd(16)} ${r.id}  ${(r.fails || []).slice(0, 4).join(', ')}`);
  }
  console.log(`\n${pass}/${total} = ${(rate * 100).toFixed(1)}%  (门槛 ${(minPass * 100).toFixed(0)}%)`);
  console.log('失败分布:', Object.entries(ruleHits).map(([k, v]) => `${k}×${v}`).join('  ') || '无');
}

process.exit(rate >= minPass ? 0 : 1);
