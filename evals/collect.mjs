#!/usr/bin/env node
// 把 ab/<arm>/<id>.json 目录收成一个 outputs 文件，供 score.mjs 判分。
// 用法：node evals/collect.mjs --dir evidence/ab/skill --out evidence/ab/skill.json
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d = null) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const dir = opt('dir');
const out = opt('out');
if (!dir || !out) { console.error('用法: --dir <目录> --out <文件>'); process.exit(1); }

const result = {};
let n = 0;
for (const f of fs.readdirSync(dir).sort()) {
  if (!f.endsWith('.json')) continue;
  const p = path.join(dir, f);
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    const id = raw.id || path.basename(f, '.json');
    const lines = Array.isArray(raw.lines) ? raw.lines.map(String)
      : Array.isArray(raw) ? raw.map(String)
      : typeof raw.text === 'string' ? raw.text.split('\n') : null;
    if (!lines) { console.error(`${f}: 找不到 lines`); continue; }
    result[id] = lines;
    n += 1;
  } catch (e) {
    console.error(`${f}: ${e.message}`);
  }
}
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(`收集 ${n} 条 → ${out}`);
