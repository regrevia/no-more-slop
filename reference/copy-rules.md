# Copy rules and rewrite recipes

## Banned Chinese phrases → what to do instead

| Banned | Why it is a defect | Rewrite |
|---|---|---|
| `即可` / `就行了` / `就好` | hides the conclusion in a subordinate clause | make it the label, or a default |
| `自动补` / `自动填` / `会自动` | describes the implementation | do it silently; accept both inputs |
| `留空` / `不填则` / `默认为空` | teaches a gesture to avoid a state | show the stored value, add `更换` |
| `（未设置）` as a value | renders a missing decision as data | one status sentence + fix action |
| `注意：` / `提示：` / `说明：` | preemptive reassurance | delete; use an error state |
| `请确保` / `如需` / `如果需要…请` | defensive conditional | the interface already enforces it |
| `建议` / `推荐` | undecided default | choose the default |
| `支持…` / `可以…` in body copy | capability described instead of offered | expose it as a control |
| `更多` with nothing important | dead grouping label | list the items, or delete |
| `正在加载…` / `请稍候` | names nothing | name the operation (`正在连接`) |
| `音色：whale` | dev enum on screen | human label in a picker |
| `宿主` / `whisper` / `worker` / `热态` / `端口` | internal vocabulary | user vocabulary, or nothing |

## Banned English

`simply`, `just`, `please note`, `note that`, `make sure`, `in order to`,
`automatically`, `will be` (future passive), `e.g.` inside helper text.
Each one is either reassurance or a restatement; both cost a line and buy nothing.

## Formulas

**Field**
`label` + `current value` (masked if secret) + an edit affordance.
Placeholder is an example, never a label, never an instruction.

**Validation** (only while invalid)
`what is wrong` + `how to fix it`, in ≤ 20 characters, no blame, no "please".
`地址不正确，应以 https:// 开头`

**Empty state**
`what this is` (3–6 chars) + one action. No marketing sentence, no illustration caption.
`还没有宠物` + `添加`

**Status**
one sentence, present tense, human noun: `已连接`, `未连接`, `麦克风未授权`.
If it is actionable, the action sits on the same row, not in a second list below.

**Permissions**
ask at the moment of use, with the reason in the system prompt. Never a permission
audit table on a settings page.

**Destructive action**
name the object and the consequence: `删除「小鲸」？` + `删除` / `取消`.
Never `确定` / `是`.

## Repairs, by example

| Before | After |
|---|---|
| `宿主地址` + `https://xxx.trycloudflare.com/pet-voice/` + `隧道会换；填主机名即可，App 自动补 /pet-voice/` | `服务地址` + placeholder `https://example.trycloudflare.com` (only under 高级) |
| `未设置` (as a field label) + `重新输入令牌（留空 = 不修改）` | `令牌` + `••••••••` + `更换` |
| `宿主：（未设置）` `令牌：未设置` `悬浮窗权限：未授权` `麦克风：未授权` `识别服务：可用` | `未连接` + `配对` (permissions requested on first use) |
| `更多 ▾` above two buttons | both buttons, listed |
| 70-character paragraph about whisper, worker, update flow, HyperOS | delete; move to README → 常见问题 |
| `保存设置` | `保存` (or autosave, and no button) |
| `音色：whale` | `音色：鲸鱼` with a picker |
| `粘贴配对链接` (as the only path) | primary input `粘贴配对链接` + `配对`; manual host/token under 高级 |

## When explanation is legitimate

Only three cases survive:

1. **irreversible loss** — "删除后不可恢复";
2. **money or privacy** — what is charged, what leaves the device;
3. **a model the user cannot infer** — e.g. "录音仅在本机处理" when the product could
   reasonably be assumed to upload it.

Everything else is documentation wearing an interface costume.

## Checklist before shipping a screen

- [ ] The screen's job fits in one sentence.
- [ ] Every string is a label, value, action, or consequence.
- [ ] No `即可` / `自动` / `留空` / `注意` / `更多`.
- [ ] No three consecutive `key：value` lines.
- [ ] No internal noun (host, worker, token, dp, ms) is visible.
- [ ] Helper text appears only on error.
- [ ] One primary button; everything else is secondary or gone.
- [ ] The last paragraph can be deleted without breaking the task.
