# Before / after

Real strings from shipped code, and what they become under the rules. Left column is
what an agent writes when it is allowed to explain itself; right column is what ships.

## 1. A settings row that turned into a manual

```diff
- 配置文件
- 导出后交给 Agent，或填写后导入。凭据不会写进导出包，导入不会自动补全缺失字段。
+ 配置文件
+ [导出配置]  [导入配置]  下载空白模板 ↗
```

The row is a **label + two actions**. Everything else was a decision the product had not
made: which file format, where credentials go, what happens to missing fields.

## 2. Import / export copy that teaches a file format

```diff
- 解压后导入 config.json
+ 导入配置
```

File format, unzipping and folder names belong in the README. A user clicking a button
does not need the archiver.

## 3. Status list crammed into one paragraph

```diff
- 结果未知时先查询 Agent；若重交，保留同一创建请求 ID 和原始定义。
+ 派工失败  ·  [重试]  [查看节点]
```

If the user cannot act on "request ID", it is an implementation detail. If retrying needs
a stable id, make retry do it — don't ask the user to preserve it.

## 4. Defensive pre-amble

```diff
- 注意：请确保网络正常，重试可能重复派工。
+ 网络断开，未派工。  [重试]
```

Warnings without a state are noise. A blocked state with one action is information.

## 5. Paragraph in an empty state

```diff
- 还没有会话。会话会自动保存，你可以随时回来继续，也可以在设置里调整保存策略。
+ 还没有会话。  [新建会话]
```

The last clause existed only because the default policy had not been chosen.

## 6. Two competing primaries

```diff
- [导出]  [导出当前配置为 JSON]  [下载模板]  [重置]
+ [导出配置]  [导入配置]   重置
```

One primary. The rest are secondary or destructive, and named by verb + object only.

## Score yourself

```bash
node scripts/ui-strings-lint.mjs .
```

`error 0` means none of the shapes above survive. `warn` lines are style, not defects.
