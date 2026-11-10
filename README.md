# No More Slop

**Stop shipping interface text that explains itself.** A rule set, a CI gate and a regression suite for the copy an AI adds to your app when you asked it to build a screen.

<p>
  <img alt="license" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D18-brightgreen">
  <img alt="tests" src="https://img.shields.io/badge/bad--sample%20recall-100%25-brightgreen">
  <img alt="status" src="https://img.shields.io/badge/gate-error%200%20or%20no%20ship-red">
</p>

> 中文速览：AI 写前端时最爱往界面里加"解释、免责、操作手册"。这个仓库把它变成**可机器验收**的规则 + 闸门 + 回归集，`node scripts/ui-strings-lint.mjs .` 的 `error` 必须为 0。

---

## The problem

Ask a model to implement a settings screen and you get the screen **plus a manual**:

| What the agent writes | Why it is wrong |
|---|---|
| `凭据不会写进导出包，导入不会自动补全缺失字段` | Two decisions the product never made, pushed onto the reader |
| `解压后导入 config.json` | Teaching a file format inside a button tooltip |
| `注意：请确保网络正常` | A warning with no state; the user can't act on it |
| `结果未知时先查询 Agent；若重交，保留同一创建请求 ID 和原始定义` | Implementation detail as user instruction |
| 3 parallel buttons, no primary | The screen has no opinion about what happens next |
| `还没有会话。会话会自动保存，你可以随时回来继续，也可以在设置里调整保存策略。` | A paragraph where the default value should have been chosen |

These are not "too long sentences". They are **a missing decision**, written down as prose and handed to the user. Shortening them does not help: a shorter apology is still an apology.

## The one principle

Interface strings may only be one of four things:

| Kind | Definition | Example |
|---|---|---|
| **Label** | names a thing | `服务地址` |
| **Value** | the state itself | `已连接` |
| **Action** | what happens when pressed | `导出配置` |
| **Consequence** | a fact that changes the next step | `删除后不可恢复` |

Anything else is deleted — not rewritten. When a sentence is needed, the fix is a **decision**, in this order:

```
default value  →  control (select / switch)  →  one line of consequence  →  [ forbidden ] paragraph
```

## Quick start

```bash
# 1. run the gate on your UI (no deps, Node >= 18)
npx github:regrevia/no-more-slop ./src
# or from a checkout
node scripts/ui-strings-lint.mjs ./src

# 2. for agents: give the skill to the model that writes the UI
cp -R . ~/.dsh/skills/no-more-slop     # DeepSeek Harness / any skill loader
# or paste SKILL.md §1–4 into AGENTS.md / CLAUDE.md / your team's copy guide
```

The gate only judges **user-visible Chinese strings**: it extracts strings first, then judges them. Object keys, imports, comments, tests and non-Chinese literals never enter the verdict — which is exactly why it can be a gate instead of a smell detector. (Scanning whole files with the same rules produced 1355 hits on keys alone in a real repo; see `evidence/report.md` §3.)

Exit code is `1` on any error, so:

```yaml
- run: node scripts/ui-strings-lint.mjs ./src
```

## What it looks like

Before / after on real code — [`examples/before-after.md`](examples/before-after.md):

```diff
- 配置文件
- 导出后交给 Agent，或填写后导入。凭据不会写进导出包，导入不会自动补全缺失字段。
+ 配置文件
+ [导出配置]  [导入配置]   下载空白模板 ↗
```

```diff
- 结果未知时先查询 Agent；若重交，保留同一创建请求 ID 和原始定义。
+ 派工失败  ·  [重试]  [查看节点]
```

```diff
- 注意：请确保网络正常，重试可能重复派工。
+ 网络断开，未派工。  [重试]
```

## Rules (the short version)

- Label ≤ 6 chars, action ≤ 6 chars (`导出配置`, not `导出当前配置为 JSON`).
- Helper text ≤ 20 chars, and only while the field is invalid.
- Status = one line, with the fix on the same line. Empty state ≤ one sentence + one action.
- Settings screen ≤ 7 rows. Exactly one primary button per screen.
- **No paragraphs inside app chrome.** Not even two sentences.
- Detail that isn't user-facing goes to the README, the tooltip, or an advanced section — never on the screen.

Eleven named defect classes (`implementation-leak`, `defensive-prefix`, `teach-gesture`, `status-dump`, `prose-block`, `action-crowd`, `restatement`, `file-format-step`, …) are tabulated in [`SKILL.md`](SKILL.md). Full Chinese rules: [`docs/rules.zh-CN.md`](docs/rules.zh-CN.md).

## Does it actually work?

We measured instead of claiming. Three A/B experiments, same model, fresh contexts, blind scoring — full numbers in [`evidence/report.md`](evidence/report.md):

| Experiment | Arm A (no skill) | Arm B (with skill) | Verdict |
|---|---|---|---|
| Write copy, 8 cases | 8/8 pass, 49 lines | 8/8 pass, 38 lines (−22%) | **no separation**: single-shot generation was already fine |
| Hard cases, 5 cases | 5/5 | 5/5, but invented a noun | threshold too low, both pass |
| Write a component *and* its copy | 23 visible strings, **0** gate errors | 18 strings (−22%), **1** gate error | skill reduces volume, **does not guarantee** |

So the honest claim is not "use this and slop never appears". It is:

> **`ui-strings-lint` error 0 ⇒ these defect shapes cannot ship.** The rules in `SKILL.md` lower the rate; the gate is what guarantees.

The one defect the skill arm still produced (`解压后导入 config.json`) is now a rule (`file-format-step`), a gate pattern and a regression case — the loop that keeps this repo useful. Precision on real code: 789 visible strings in a 139-file tree → 32 hits (4.1%), all genuine on manual review.

## Repo layout

```
SKILL.md                    agent-facing skill: admission, defect table, budgets, procedure, acceptance
docs/rules.zh-CN.md         the same rules, human-readable
scripts/ui-strings-lint.mjs gate: visible-string extraction + 8 rules, exit 1
evals/cases.jsonl           30 regression cases across 8 surface classes
evals/cases-hard.jsonl      5 hard cases (multi-branch, credentials, timeout, permission, import)
evals/score.mjs             scorer (--bad / --good / --outputs)
evals/validate-cases.mjs    dataset self-check
evals/extract-strings.mjs   measure visible strings / paragraphs / banned words
examples/before-after.md    real strings, before and after
evidence/report.md          all measurements, including what they do not prove
```

## Scope

Chinese product UI in web and app surfaces: settings, forms, onboarding, errors, empty states, permissions, import/export, agent-collaboration panels. English UI is structurally the same problem and the rules port over; the shipped rule table is tuned for Simplified Chinese. Not a prose editor — use it for **interface strings**, not for docs, marketing pages or changelogs.

## Contributing

Every rule here exists because something shipped that shouldn't have. Add a defect only with: a name, a gate rule that fires on visible strings only, and a case in the regression set. Recall stays at 100%, and precision is re-measured on a real repo. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT © 2026 谭懿铖 (Tan Yicheng)
