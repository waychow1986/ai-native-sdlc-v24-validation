# Task Planning 阶段门禁报告

## 门禁信息

- **阶段：** `task-planning`
- **检查轮次：** 1
- **当前制品：** `tasks-implementation.md`
- **直接前置制品：** `design.md`
- **结论：** `需要修复`

## 内部自检

已检查全部 71 项任务的完整性、依赖顺序、准确路径、test-first 顺序、可执行性和完成证据。任务总体按 Setup、Foundational、User Story 和 Candidate 收尾组织，服务端、契约、数据库及主要验收场景具有明确的先测后实现关系；但前端增量缺少必要装配路径，且 OCI image 任务没有先行测试和充分完成证据，尚未达到实施就绪状态。

## 直接前置一致性检查

已逐项对照已批准 `design.md` 的组件根路径、前端组合边界、单一 OCI image 决策、验证环境责任和部署要求，并使用 `spec.md` 核对继承的验收场景追踪。发现的问题均为清晰 Technical Solution 的任务覆盖或顺序缺口，责任属于当前 `task-planning` 阶段，不满足上游例外条件。

## 阻塞项

### TASK-SELF-001 前端故事增量缺少可执行的装配路径

- **严重性：** `high`
- **范围：** `self`
- **制品：** `tasks-implementation.md`
- **责任 Agent：** `task-planning`
- **路由：** `current_stage`
- **原因类型：** `coverage`
- **证据：** T025 将看板入口固定在 `apps/web/src/components/Board.tsx` 与 `apps/web/src/main.tsx`，但后续 T033、T041、T049、T056 只列出新增表单、任务卡、删除对话框、反馈组件及各自状态文件，均未列出需要修改的既有页面或组合根路径；T057 也只列出两个 CSS 文件，没有列出任何样式导入路径。按任务声明的准确改动路径实施时，创建、状态变更、删除、恢复反馈及响应式/可访问样式无法接入已渲染应用；若在 T025 预先引用尚不存在的后续模块，又会破坏 US1 先行测试和可演示增量。该缺口阻塞 `FR-002`、`FR-004`、`FR-005`、`FR-007`、`FR-009`、`FR-010` 及对应 IQA 场景。
- **修复建议：** 为各前端实现任务补充实际需要修改的组合根、任务卡、API client 和样式入口准确路径，并调整依赖，使每个 User Story 在其实现任务完成后即可独立构建、运行和通过该故事的先行测试。

### TASK-SELF-002 OCI image 任务违反 test-first 且完成证据不足

- **严重性：** `high`
- **范围：** `self`
- **制品：** `tasks-implementation.md`
- **责任 Agent：** `task-planning`
- **路由：** `current_stage`
- **原因类型：** `incomplete`
- **证据：** `design.md` 第 208 行要求 multi-stage Dockerfile 固定 Node 24.x patch、在 build stage 执行静态分析和生产构建，并保证 runtime stage 仅含生产依赖、编译产物且使用非 root 用户。T069 先实现 `Dockerfile`，其后 T070 才创建 Candidate 容器验证，违反本制品第 7 行的测试先于生产实现规则；T070 仅断言 migration、三个健康端点和 probe 隔离，未验证固定 patch 一致性、build-stage 静态分析、非 root 身份或 runtime 仅含生产依赖。T069 自身的 build、history 与环境检查也不能证明这些独立要求，导致关键生产候选约束缺少失败先行测试及可判定完成证据。
- **修复建议：** 在 T069 前增加或前移可执行的 image 结构与运行约束测试，覆盖 Node patch 一致性、build-stage 必需步骤、非 root runtime 和生产依赖/产物边界；让 T069 依赖该先行测试，并以其通过作为完成证据。

## 通过条件

修复上述全部阻塞项后，重新执行 `task-planning` 阶段门禁；只有前端各故事具备完整准确的装配路径，且 OCI image 约束具有先行测试、正确依赖和可判定完成证据时，当前阶段方可通过。
