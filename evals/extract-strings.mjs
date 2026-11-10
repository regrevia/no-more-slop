#!/usr/bin/env node
// 从 tsx/ts/jsx/js/html 里抽出「用户可见中文串」，用来量 AI 顺手加的文案。
// 用法：node evals/extract-strings.mjs <dir|file> [--json]
// 输出指标：可见串数、中文字数、超长行（≥24 中文字）、段落句（含 。；且 ≥24 字）、禁用词命中。
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const asJson = args.includes('--json');
if (!target) { console.error('用法: node evals/extract-strings.mjs <dir|file> [--json]'); process.exit(1); }

const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.html', '.vue', '.svelte']);
const CJK = /[\u3400-\u9fff]/gu;
const cjkLen = (s) => (s.match(CJK) || []).length;
// 只在"看起来是展示文案"的上下文里取中文：引号串、模板串、JSX 文本
const STR_RE = /(['"`])((?:\\.|(?!\1)[\s\S]){2,400}?)\1/g;
const JSX_TEXT_RE = />([^<>{}\n]{2,400})</g;
const BANNED = ['即可', '注意：', '提示：', '说明：', '请确保', '如需', '留空', '自动补', '不会自动', '请放心', '可能是', '注意 ', '更多 ▾', 'README', 'Token', '脚本', 'worker', '会话', '上下文', 'JSON', '解压'];

const files = [];
const walk = (p) => {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const f of fs.readdirSync(p)) {
      if (f === 'node_modules' || f.startsWith('.')) continue;
      walk(path.join(p, f));
    }
  } else if (EXTS.has(path.extname(p))) files.push(p);
};
walk(target);

const out = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const cands = [];
  let m;
  while ((m = STR_RE.exec(src))) cands.push(m[2]);
  while ((m = JSX_TEXT_RE.exec(src))) cands.push(m[1]);
  cands.forEach((raw, i) => {
    const s = raw.replace(/\\n/g, '\n').trim();
    if (!s || !/[\u3400-\u9fff]/.test(s)) return;
    if (/^(https?:|\/|\.\/|@)/.test(s)) return;
    out.push({ file: path.relative(target, f), line: src.slice(0, src.indexOf(raw)).split('\n').length, text: s });
  });
}

const lines = out.flatMap((o) => o.text.split('\n').filter(Boolean));
const metrics = {
  files: files.length,
  strings: out.length,
  cjkChars: lines.reduce((n, l) => n + cjkLen(l), 0),
  longLines: lines.filter((l) => cjkLen(l) >= 20).length,
  proseSentences: lines.filter((l) => cjkLen(l) >= 24 && /[。；]/.test(l)).length,
  bannedHits: lines.filter((l) => BANNED.some((b) => l.includes(b))).length,
  bannedDetail: lines.filter((l) => BANNED.some((b) => l.includes(b))).slice(0, 12),
};

if (asJson) console.log(JSON.stringify({ metrics, strings: out }, null, 2));
else {
  console.log(JSON.stringify(metrics, null, 2));
  for (const l of metrics.bannedDetail) console.log('  ⚠', l.slice(0, 80));
}
