# AI Delivery Markdown 模板

本目录包含 WorkflowVersion 20 使用的 Markdown 结构契约。模板是只读参考，不是当前 Delivery 的
权威制品。Agent 必须将对应模板的必需章节和顺序应用到 active Feature 或 Bugfix
目录中的实际制品，并在提交前删除模板说明、示例和占位内容。

Intent、Specification、Technical Solution 和 Task Planning 的主制品只记录
各自阶段的权威内容，不包含自检清单、门禁结论或修复状态。阶段内部自检及与直接前置
制品的一致性检查统一写入 `stage-gate-report.template.md` 对应的独立报告。

## 权威制品模板

- `constitution.template.md`
- `intent.template.md`
- `spec.template.md`
- `technical-baseline.template.md`
- `design.template.md`
- `tasks-implementation.template.md`

## 阶段与审计报告模板

- `stage-gate-report.template.md`
- `implementation-report.template.md`
- `convergence-report.template.md`

## Bugfix 证据模板

- `bug-assessment.template.md`
- `bug-fix.template.md`
- `bug-test.template.md`

机器投影、运行时契约和编排状态必须使用其 JSON Schema，不得从 Markdown 模板推断。
