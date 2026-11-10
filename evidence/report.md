# ui-restraint / ui-copy v3 实测报告

日期：2026-11-09（Asia/Shanghai）。全部数字来自本目录下脚本，命令可直接复跑。
结论先说：**"用了 skill 就一定不出多余文案" 这句话不成立**；能承诺的是"闸门不过就不交付"。下面是凭什么这么说。

---

## 1. 判据可靠吗（第 1 层）

| 检查 | 命令 | 结果 |
|---|---|---|
| 数据集自检 | `node evals/validate-cases.mjs` | 30 条 case / 8 个界面类 / must_absent 30/30 命中 / OK |
| 坏样本召回 | `node evals/score.mjs --cases evals/cases.jsonl --bad` | 30/30 = 100.0%，分布 forbidden×150 missing×27 long-line×50 prose-block×32 warn×28 |
| 硬样本 | `node evals/score.mjs --cases evals/cases-hard.jsonl --outputs evidence/ab/baseline-all.json` | A 5/5 · B 5/5（见 E2：判据区分不开） |

**这层是循环验证**：`must_absent` 是从 `bad_sample` 反推的，所以 100% 只说明判据不宽松，不说明 skill 有用。报告里不许把它当疗效。

## 2. 模型在真实任务里会不会犯（第 2 层）

三个实验，同一模型（deepseek-v4.1-flash）、fresh context、同一判分器，A 臂无 skill / B 臂有 skill。

### E1 直接写文案（8 case × 2 臂，16 agent）

- A：8/8 通过，49 行（`[7,12,3,4,3,13,4,3]`）
- B：8/8 通过，38 行（`[5,7,2,3,3,12,3,3]`），-22%
- 失败分布两臂都是 `warn×8 no-output×22`（warn 是 `no-primary-marker`，非致命）
- 抽样细看：`settings-import-01` A 7 行→B 5 行（B 砍掉辅助行和空状态）；`error-load-11` A 3 行→B 2 行（B 砍掉可推断的原因行）；`perm-admin-19` 两臂完全相同（都只有 3 行，已到下限）

**结论**：单轮生成时这个模型本来就不写段落，两臂都过，**A/B 无法证明 skill 有效**。

### E2 硬样本（5 case：多分支、凭据、超时接管、权限失败、导入 Skill）

- A 5/5（49 字均）· B 5/5（仍出现 1 处编造）
- 举例：`hard-config-export-31` A 10 行 / B 9 行；B 出现「导出」与「导出配置」并存（restatement）
- `hard-error-tool-34` B 写出「日历未获授权」——需求里没有"日历"，属编造

**结论**：把 case 造难只会让两臂一起变差，判据仍是二值通过，区分不出来。

### E3 真实失败模式：写代码时顺手补文案（2 组件 × 2 臂，4 agent）

缺陷真实来源不是"专门写文案"，是"实现功能时顺手加一句"。所以让 agent 各写一个组件（`SettingsConfig.tsx` / `DispatchFail.tsx`），A 只实现，B 先读 SKILL.md。

| 指标 | A（无 skill） | B（有 skill） |
|---|---|---|
| 可见串 | 23 | 18（-22%） |
| 中文字数 | — | 更少 |
| `ui-strings-lint` error | **0** | **1**（`解压后导入 config.json` = file-format-step） |

**结论**：skill 减量但**不保证不犯**；B 臂那个 error 是被闸门抓住的。→ 交付物是"规则 + 闸门 + 回归集"，不是提示词。

## 3. 闸门在真实仓库上的精度（第 3 层）

`node scripts/ui-strings-lint.mjs <dir>`（只抽可见中文串，对象键/import/注释/测试不进判据）

| 目录 | 文件 | 可见串 | 命中 | 命中率 | 抽检 |
|---|---|---|---|---|---|
| `symate/src/plugins` | 139 | 789 | 32 | 4.1% | 全为真缺陷：`仅显示逻辑费用，删除后额度需等待核对。已发出的预览不会因此撤销。`、`删除结果未确认，请核查；…`、`请填写有效的 HTTPS API 地址` |
| `symate/agent-cli/src/user` | 15 | 180 | 30 | 16.7% | `agents.ts:52` 真阳性（真阳性目标达成）：`结果未知时先查询 Agent；若重交，保留同一创建请求 ID 和原始定义。` → implementation-leak + prose-block |

对照组（同一仓库、旧扫描器扫全文）：`dev-term` 1355 命中、`status-dump` 1006 命中，绝大多数是 `home: f.home,` / `model: null,` 这类对象键值 → 旧版只能当气味探测器，**本版可上 CI**（exit 1）。

## 4. 回灌记录（规则是怎么变硬的）

| 来源 | 新规则 | 已进 |
|---|---|---|
| E3 B 臂失败 `解压后导入 config.json` | `file-format-step`：导入导出不写文件格式/步骤 | 缺陷表 + lint(`implementation-leak` 词表) + `hard-import-skill-35.must_absent` |
| E2 B 臂 `导出`/`导出配置` 并存 | `restatement` 扩展为"同屏一个概念只出现一次" | 第四节第 6 步「事实锁」 |
| E2 B 臂编造「日历」 | 事实锁：只能用需求里给过的名词/数字 | 第四节第 6 步 |
| 旧 lint 在真实仓库产生上千条对象键噪音 | 改为"先抽可见串再判" | `scripts/ui-strings-lint.mjs` 重写 |

## 5. 复跑清单

```bash
cd /Users/apple/Desktop/work/Symate/tools/ui-copy
node evals/validate-cases.mjs
node evals/score.mjs --cases evals/cases.jsonl --bad
node scripts/ui-strings-lint.mjs ../../symate/src/plugins        # 期望 32 error 左右
node evals/extract-strings.mjs evidence/abcode/baseline          # 量可见串/字数
```

## 6. 还不知道的（写在明处）

- B 臂每次都能比 A 臂少 20% 左右，但样本量小（E1 8 对、E3 2 对），**没有统计显著性**，不能宣称"平均减少 22%"。
- 长上下文/多轮续改场景（真实缺陷高发处）没做 A/B，只有 E3 近似。
- 判据是规则引擎，抓不到"该做决定却写了两行都合理"的语义问题，仍要人工自检那 4 问。
