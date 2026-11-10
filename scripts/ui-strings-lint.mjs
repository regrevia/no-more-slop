#!/usr/bin/env node
// ui-strings-lint —— 只判「用户可见中文界面串」的界面文案闸门。
// 与旧 ui-copy-lint 的区别：旧版扫全文件当气味探测器（对象键、字段、注释、内部变量全算）；
// 本版先按行抽取可见串再判，所以对象键 / import / 注释 / 测试 / 非中文串不进判据，可当 CI 闸门。
//
// 用法：node scripts/ui-strings-lint.mjs <目录|文件...> [--json] [--max-prose=24] [--warn-only]
// 退出码：有 error → 1；只有 warn 或干净 → 0。

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const roots = args.filter((a) => !a.startsWith('--'));
const asJson = args.includes('--json');
const warnOnly = args.includes('--warn-only');
const maxProse = Number((args.find((a) => a.startsWith('--max-prose=')) || '').split('=')[1] || 24);
if (!roots.length) { console.error('用法: node scripts/ui-strings-lint.mjs <目录|文件...> [--json] [--warn-only]'); process.exit(1); }

const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.html', '.vue', '.svelte']);
const HAS_CJK = /[\u3400-\u9fff]/;
const CJK = /[\u3400-\u9fff]/gu;
const cjkLen = (s) => (s.match(CJK) || []).length;
const QUOTED = /(['"`])([^'"`]{1,400})\1/g;
const BETWEEN_TAGS = />([^<>{}]{1,400})</g;

// ---- 规则（界面文案该长什么样）----
const RULES = [
  { id: 'implementation-leak', level: 'error',
    test: (s) => /worker|端口|宿主|毫秒|\d+\s*ms\b|请求 ?ID|README|解压|脚本|环境变量|端点|endpoint|payload|进程|轮询|兜底|降级/i.test(s),
    msg: '用户不需要知道实现细节' },
  { id: 'defensive-prefix', level: 'error',
    test: (s) => /注意[:：]|提示[:：]|说明[:：]|请确保|请确认|如需|请放心|可能是|请勿|勿将|不会自动|本次请求|建议先/.test(s),
    msg: '交付说明/免责话不该上屏' },
  { id: 'teach-gesture', level: 'error',
    test: (s) => /(复制|粘贴|填写|运行|解压|打开).{0,12}(到|后|再|说明|脚本|文件)/.test(s) && cjkLen(s) > 14,
    msg: '流程在控件里完成，不写成句子' },
  { id: 'status-dump', level: 'error',
    test: (s) => /^(未设置|未授权|未连接|未开启)/.test(s) || /^[\u4e00-\u9fff]{2,6}[:：]\s*[^\s]/.test(s),
    msg: '状态一行一句，不要键值清单' },
  { id: 'dev-enum-leak', level: 'error',
    test: (s) => /(JSON|YAML|\btsx?\b|\bAPI\b|\bSDK\b|\bURL\b|\bHTTP\b|WebSocket|Markdown|\bCSV\b)/.test(s),
    msg: '协议/类型名不该出现在界面' },
  { id: 'prose-block', level: 'error',
    test: (s) => cjkLen(s) >= maxProse && /[。；]/.test(s),
    msg: `界面里不允许段落（≥${maxProse} 字）` },
  { id: 'long-line', level: 'error',
    test: (s) => cjkLen(s) >= 20 && !/[。；]/.test(s),
    msg: '一行超过 20 个中文字' },
  { id: 'filler', level: 'warn',
    test: (s) => /即可|更多|留空|自动补|默认值|您好|欢迎使用/.test(s),
    msg: '填充词，删掉' },
];

const collectFiles = () => {
  const files = [];
  const walk = (p) => {
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const f of fs.readdirSync(p)) {
        if (['node_modules', 'dist', '.git'].includes(f) || f.startsWith('.')) continue;
        walk(path.join(p, f));
      }
    } else if (EXTS.has(path.extname(p)) && !/\.(test|spec)\./.test(p)) files.push(p);
  };
  roots.forEach(walk);
  return files;
};

const stringsOf = (file) => {
  const raw = fs.readFileSync(file, 'utf8');
  // 去块注释（保留行号：用等量换行替换）
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const out = [];
  src.split('\n').forEach((line, i) => {
    const t = line.trim();
    if (!HAS_CJK.test(t)) return;
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('import ') || t.startsWith('export type')) return;
    const push = (s) => {
      const v = s.trim();
      if (!v || !HAS_CJK.test(v)) return;
      if (/ui-copy-ignore/.test(v)) return;
      if (/^(https?:|\/|\.\/|@|#)/.test(v)) return;
      out.push({ file, line: i + 1, text: v });
    };
    for (const m of t.matchAll(QUOTED)) push(m[2]);
    for (const m of t.matchAll(BETWEEN_TAGS)) push(m[1]);
  });
  // 同一文件同一行同一串去重
  const seen = new Set();
  return out.filter((o) => {
    const k = `${o.line}:${o.text}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const files = collectFiles();
const visible = files.flatMap(stringsOf);
const hits = [];
for (const v of visible) {
  for (const r of RULES) if (r.test(v.text)) hits.push({ rule: r.id, level: r.level, msg: r.msg, ...v });
}
const errors = hits.filter((h) => h.level === 'error');
const warns = hits.filter((h) => h.level === 'warn');

if (asJson) {
  console.log(JSON.stringify({ files: files.length, strings: visible.length, errors: errors.length, warns: warns.length, hits, visible }, null, 2));
} else {
  for (const h of hits) console.log(`${h.level === 'error' ? '✗' : '·'} ${h.rule}  ${path.relative(process.cwd(), h.file)}:${h.line}  ${h.text.slice(0, 60)}`);
  console.log(`\n文件 ${files.length} · 可见串 ${visible.length} · error ${errors.length} · warn ${warns.length}`);
  if (errors.length) {
    const byRule = {};
    for (const h of errors) byRule[h.rule] = (byRule[h.rule] || 0) + 1;
    console.log('error 分布:', Object.entries(byRule).map(([k, v]) => `${k}×${v}`).join('  '));
  }
}
process.exitCode = !warnOnly && errors.length > 0 ? 1 : 0;
