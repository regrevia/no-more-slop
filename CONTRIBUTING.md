# Contributing

The value of this repo is that its rules are **measured**, not asserted. So the flow is
always the same:

1. **Name the defect.** One row in the table in `SKILL.md` (§2). If it cannot be named,
   it is not a rule yet.
2. **Add the gate.** A rule in `scripts/ui-strings-lint.mjs`, visible-string only —
   object keys, imports, comments and tests must stay out of judgement.
3. **Add the case.** A line in `evals/cases.jsonl` (or `cases-hard.jsonl`), with a real
   `bad_sample` and the `must_absent` entries that catch it.
4. **Re-measure.** `npm test` must stay at 100% recall; run the linter over a real
   repository and confirm the hit count did not explode (precision is a feature).
5. **Update the numbers.** `evidence/report.md`, including what the change did *not*
   prove.

The regression set only grows. A rule that fires on clean code gets fixed, not waived.

Useful commands:

```bash
node evals/validate-cases.mjs
node evals/score.mjs --cases evals/cases.jsonl --bad
node evals/score.mjs --cases evals/cases-hard.jsonl --outputs evidence/ab/baseline-all.json
node evals/extract-strings.mjs <dir> --json     # count visible strings, paragraphs, banned words
```
