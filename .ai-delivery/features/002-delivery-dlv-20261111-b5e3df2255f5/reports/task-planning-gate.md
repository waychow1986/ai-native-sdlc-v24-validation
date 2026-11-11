# Task Planning 阶段门禁报告

## 门禁信息

- **阶段：** `task-planning`
- **检查轮次：** 2
- **当前制品：** `tasks-implementation.md`
- **直接前置制品：** `design.md`
- **结论：** `需要修复`

## 内部自检

已检查全部任务的阶段划分、依赖顺序、准确路径、执行前置条件、test-first 顺序和完成证据。Setup、Foundational、三个 User Story 与 Polish 的生产改动均有明确路径和依赖，测试任务位于对应实现之前，实际改动路径均受 Design 根路径清单支持；但唯一强制开发者测试入口遗漏了计划中独立存在的 unit 测试套件，导致最终完成证据不完整。

## 直接前置一致性检查

已逐项核对 approved `design.md` 的技术决策、Component 边界、状态与接口契约、安全边界、验证环境责任矩阵及 Quickstart，并以 `spec.md` 仅核验 IQA 场景追踪。Tasks 已覆盖应用、容器、部署声明及所需 Candidate 级自动化输入，但没有落实 Design 明确要求由 `npm run check` 执行的项目 lint。Design 本身不存在严格上游例外；全部问题均归属当前 Task Planning。

## 阻塞项

### TASK-SELF-001 强制 `npm test` 聚合遗漏 unit 测试套件

- **严重性：** `high`
- **范围：** `self`
- **制品：** `tasks-implementation.md`
- **责任 Agent：** `task-planning`
- **路由：** `current_stage`
- **原因类型：** `contradiction`
- **证据：** T007 要求在 `tests/unit/server-foundation.test.ts` 编写服务端基础边界测试；但任务规则、T001 及完成证据均将唯一强制 `npm test` 聚合限定为 component、contract、integration、functional 和 Playwright end-to-end 五类，没有包含 unit。按当前计划，T007 可在定向执行时通过，却不会被唯一最终开发者测试入口强制执行。
- **修复建议：** 将 unit 套件加入 T001、任务规则和完成证据中的 `npm test` 串行聚合范围，确保 T007 由唯一强制开发者测试入口执行。

### TASK-SELF-002 未落实 Design 要求的 lint 检查

- **严重性：** `high`
- **范围：** `self`
- **制品：** `tasks-implementation.md`
- **责任 Agent：** `task-planning`
- **路由：** `current_stage`
- **原因类型：** `coverage`
- **证据：** approved `design.md` 的 Quickstart 明确要求 `npm run check` 同时执行 TypeScript no-emit 检查与项目 lint。T003 只配置 TypeScript 检查与 no-emit 边界，T001 的工具清单未包含 lint 工具，其他任务也没有安装、配置或验证 lint；T036 仅引用尚未被任务落实的 `npm run check`。因此 Coding 无法仅按任务清单建立 Design 要求的完整 static analysis 门禁。
- **修复建议：** 在 Design 授权的准确路径内增加 lint 工具、配置、`check` 聚合及完成证据任务，并明确其依赖和 clean runner 可执行性。

## 通过条件

修复全部两个阻塞项：确保 `npm test` 强制执行 unit 套件，并补齐 `npm run check` 的 lint 工具、配置与验证任务。修复后重新执行 Task Planning 内部自检和与 approved `design.md` 的直接前置一致性检查，且 findings 为空。
