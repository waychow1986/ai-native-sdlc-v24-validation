# Task Planning 阶段门禁报告

## 门禁信息

- **阶段：** `task-planning`
- **检查轮次：** 3
- **当前制品：** `tasks-implementation.md`
- **直接前置制品：** `design.md`
- **结论：** `需要修复`

## 内部自检

已检查全部任务的阶段划分、依赖顺序、准确路径、执行前置条件、test-first 顺序和完成证据。任务已修复上一轮 `npm test` 遗漏 unit 套件及 `npm run check` 遗漏 lint 的问题，生产改动路径也均受 Design 根路径清单支持；但 Setup 中一项任务缺少其完成证据所需依赖，另一项任务要求在应用源码创建前证明完整构建成功，因而当前计划不能按声明顺序逐项完成并留证。

## 直接前置一致性检查

已逐项核对 approved `design.md` 的技术决策、Component 边界、接口与安全契约、验证环境责任矩阵及 Quickstart，并以 `spec.md` 仅核验 IQA 场景追踪。Tasks 未完整覆盖状态接口拒绝 request body 的明确 Design 契约；同时，计划用于证明 viewport 与 zoom 边界的测试环境不能产生其声称的布局证据。Design 对这些要求表述明确、可行且无治理冲突，因此问题均归属当前 Task Planning，不满足上游例外条件。

## 阻塞项

### TASK-SELF-001 T003 缺少完成证据所需的 lockfile 安装依赖

- **严重性：** `high`
- **范围：** `self`
- **制品：** `tasks-implementation.md`
- **责任 Agent：** `task-planning`
- **路由：** `current_stage`
- **原因类型：** `contradiction`
- **证据：** 依赖关系和 T003 均声明 T003 只依赖 T001，并允许 T003 与 T002 并行；但 T003 的完成证据明确要求“clean runner 经 T002 安装后执行 `npm run check`”。按现有依赖顺序执行 T003 时，T002 的可复现 lockfile 及其安装结果并不保证存在，无法取得任务规定的完成证据。
- **修复建议：** 使 T003 显式依赖 T002，并同步修正 Phase 1 依赖说明，确保 clean runner 安装前置于 T003 的静态分析完成证据。

### TASK-SELF-002 T004 的完成证据在其执行阶段不可取得

- **严重性：** `high`
- **范围：** `self`
- **制品：** `tasks-implementation.md`
- **责任 Agent：** `task-planning`
- **路由：** `current_stage`
- **原因类型：** `infeasible`
- **证据：** T004 位于必须先于 Foundational 和全部 User Story 完成的 Setup，且只依赖 T001，却以“`npm run build` 生成约定客户端和服务端产物”为完成证据。客户端入口、组件和服务端实现直到 T009、T015～T018、T024～T025、T032 才创建；因此 Coding 按任务顺序执行到 T004 时不存在可供完整构建的应用源码，不能满足该任务的完成定义。
- **修复建议：** 将 T004 的 Setup 完成证据限定为可在当时验证的构建配置，或把完整前后端构建证据安排到全部所需源码完成后的显式验证任务，并保持依赖闭合。

### TASK-SELF-003 状态接口拒绝 request body 的 Design 契约缺少任务覆盖

- **严重性：** `high`
- **范围：** `predecessor`
- **制品：** `tasks-implementation.md`
- **责任 Agent：** `task-planning`
- **路由：** `current_stage`
- **原因类型：** `coverage`
- **证据：** approved `design.md` 的产品接口规定请求无 request body，安全章节进一步明确 Fastify 必须拒绝状态路径上的 request body。T019 的 wire contract test 覆盖状态码、媒体类型、精确响应、缓存、非 GET 和未知 API，却未覆盖带 body 的 `GET /api/status`；T024 也未明确实现或以完成证据验证该拒绝行为。现有任务无法证明这一明确接口与安全契约已实现。
- **修复建议：** 在 T019 明确增加状态路径 request body 拒绝的 contract test，并在 T024 的实现范围与完成证据中落实该契约，保持测试先于实现。

### TASK-SELF-004 viewport 与 zoom 完成证据所用测试环境不可验证布局

- **严重性：** `high`
- **范围：** `self`
- **制品：** `tasks-implementation.md`
- **责任 Agent：** `task-planning`
- **路由：** `current_stage`
- **原因类型：** `infeasible`
- **证据：** T033 要求在 `.test.tsx` functional 测试中证明 320～1440 CSS 像素及 200% 放大时标题、状态和重试操作不丢失，T034 又以该结果作为样式收口证据；但该类 DOM/component 测试不执行真实浏览器布局与缩放。现有 Playwright 任务 T030 只声明三类旅程、axe、键盘、焦点和状态感知，未承担 viewport/zoom 布局断言，完成证据因此不能证明 Design 所列边界。
- **修复建议：** 将 viewport 与 200% zoom 的自动化检查安排到真实浏览器测试任务并保留对应证据；functional 测试仅承担其环境能够确定验证的语义与交互断言。

## 通过条件

修复全部四个阻塞项：闭合 T003 的安装依赖；使 T004 的完成证据与执行阶段相容；补齐状态接口 request body 拒绝契约的 test-first 覆盖；并使用真实浏览器验证 viewport 与 zoom 边界。修复后重新执行 Task Planning 内部自检和与 approved `design.md` 的直接前置一致性检查，且 findings 为空。
