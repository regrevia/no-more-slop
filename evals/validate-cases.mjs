#!/usr/bin/env node
// 校验 evals/cases.jsonl：行数、JSON 合法性、id 唯一、must_absent 可命中、
// must_present 取自 facts、每条 bad_sample 4–6 行且踩 ≥2 类缺陷、8 类 surface 覆盖。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const file = join(here, 'cases.jsonl')

const DEFECTS = new Set([
  'implementation-leak',
  'clause-conclusion',
  'teaching-a-gesture',
  'status-dump',
  'dev-enum-leak',
  'meta-label',
  'restatement',
  'preemptive-warning',
])
const SURFACES = ['设置页', '导入导出', '错误态', '空状态', '权限', '多 agent 协作', '按钮与动作命名', '状态行']
const REQUIRED = ['id', 'surface', 'intent', 'facts', 'bad_sample', 'must_absent', 'must_present', 'max_chars_per_line', 'expect_one_primary', 'defects']

const errors = []
const warnings = []
const fail = (i, msg) => errors.push(`L${i}: ${msg}`)

const raw = readFileSync(file, 'utf8')
const lines = raw.split('\n').filter(l => l.trim() !== '')
if (lines.length !== 30) errors.push(`行数 ${lines.length}，应为 30`)

const ids = new Set()
const seenSurfaces = new Set()
let missingHit = 0
let allHitCases = 0

lines.forEach((line, idx) => {
  const n = idx + 1
  let c
  try {
    c = JSON.parse(line)
  } catch (e) {
    fail(n, `JSON 解析失败：${e.message}`)
    return
  }
  for (const key of REQUIRED) if (!(key in c)) fail(n, `缺字段 ${key}`)
  if (typeof c.id !== 'string' || !c.id) fail(n, 'id 不是非空字符串')
  else if (ids.has(c.id)) fail(n, `id 重复：${c.id}`)
  else ids.add(c.id)

  if (typeof c.surface !== 'string') fail(n, 'surface 不是字符串')
  else seenSurfaces.add(SURFACES.find(s => c.surface.startsWith(s)) ?? c.surface)

  if (!Array.isArray(c.facts) || c.facts.length < 2) fail(n, 'facts 少于 2 条')
  if (!Array.isArray(c.must_present) || c.must_present.length === 0) fail(n, 'must_present 为空')
  else {
    const facts = new Set(c.facts ?? [])
    for (const p of c.must_present) {
      if (!facts.has(p)) fail(n, `must_present「${p}」不在 facts 里`)
    }
  }

  if (!Array.isArray(c.defects) || c.defects.length < 2) fail(n, 'defects 少于 2 类')
  else for (const d of c.defects) if (!DEFECTS.has(d)) fail(n, `未知缺陷名：${d}`)

  if (typeof c.bad_sample !== 'string') {
    fail(n, 'bad_sample 不是字符串')
    return
  }
  const sampleLines = c.bad_sample.split('\n').filter(l => l.trim() !== '')
  if (sampleLines.length < 4 || sampleLines.length > 6) fail(n, `bad_sample 行数 ${sampleLines.length}，应为 4–6`)
  // 说明性长句：至少一行明显超出该屏行宽预算（缺陷本身）
  if (typeof c.max_chars_per_line === 'number' && !sampleLines.some(l => [...l].length > c.max_chars_per_line)) {
    fail(n, `bad_sample 没有超出 ${c.max_chars_per_line} 字行宽的说明长句`)
  }

  if (typeof c.max_chars_per_line !== 'number' || c.max_chars_per_line < 6 || c.max_chars_per_line > 30) {
    fail(n, 'max_chars_per_line 应为 6–30 的数字')
  }
  if (typeof c.expect_one_primary !== 'boolean') fail(n, 'expect_one_primary 不是布尔')

  if (!Array.isArray(c.must_absent) || c.must_absent.length < 3) {
    fail(n, 'must_absent 少于 3 条')
    return
  }
  let caseHits = 0
  for (const pattern of c.must_absent) {
    if (typeof pattern !== 'string' || !pattern) {
      fail(n, 'must_absent 含非法项')
      continue
    }
    let hit = c.bad_sample.includes(pattern)
    if (!hit) {
      try {
        hit = new RegExp(pattern).test(c.bad_sample)
      } catch {
        hit = false
      }
    }
    if (hit) caseHits++
    else {
      missingHit++
      fail(n, `must_absent「${pattern}」在 bad_sample 中未命中`)
    }
  }
  if (caseHits === c.must_absent.length) allHitCases++
})

for (const s of SURFACES) if (!seenSurfaces.has(s)) errors.push(`surface 未覆盖：${s}`)
for (const s of seenSurfaces) if (!SURFACES.includes(s)) warnings.push(`surface 归类不明：${s}`)

console.log(`cases: ${lines.length}`)
console.log(`surfaces: ${[...seenSurfaces].join(' / ')}`)
console.log(`must_absent 全部命中: ${allHitCases}/${lines.length} 条 case，未命中项 ${missingHit} 个`)
if (warnings.length) console.log(`warnings:\n  ${warnings.join('\n  ')}`)
if (errors.length) {
  console.error(`\nFAIL ${errors.length} 项：\n  ${errors.join('\n  ')}`)
  process.exit(1)
}
console.log('\nOK 全部校验通过')
