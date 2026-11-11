# 团队任务看板实施任务

## 任务规则

- 每项任务使用格式：`- [ ] T001 [P?] [US?] 描述（准确仓库路径）`
- 每项任务必须引用来源 Intent、Specification 场景、Contract 或技术决策。
- 测试任务必须位于对应生产实现任务之前。
- CI、部署、Independent QA、UAT、发布、Review 和 Merge 结果属于下游平台证据。

## 依赖关系

- Phase 1 无前置依赖；`T001` 完成后，其余 Setup 任务可并行。
- Phase 2 依赖全部 Setup 任务；其中测试先行，`T012`—`T017` 分别依赖对应测试或已验证的基础实现。
- 各 User Story 的测试依赖 `T017` 完成，可在文件互不冲突时并行；该故事的生产实现必须等待该故事全部先行测试落盘。
- User Story 按 `US-001` 至 `US-006` 顺序形成可演示增量；后续故事的界面实现显式依赖前一故事的界面增量。
- Phase 9 依赖全部 User Story，实现 Coding 所负责的 Candidate、部署契约和下游自动化输入，不依赖远程部署或审批结果。

## Phase 1：Setup

- [ ] T001 初始化 npm workspaces、固定已批准依赖与验证 scripts，并生成一致 lockfile；以 `npm ci --ignore-scripts` 成功和 lockfile 无漂移为证据（`package.json`、`package-lock.json`；来源：`TD-001`、`TD-003`、`TD-006`、`TD-009`、Quickstart；依赖：无）
- [ ] T002 [P] 固定与依赖和容器一致的 Node.js 24.x patch；以版本文件可被 Node 版本管理器解析为证据（`.nvmrc`；来源：`TD-001`、技术上下文；依赖：T001）
- [ ] T003 [P] 建立共享严格 TypeScript 编译基线；以各 workspace 配置可继承且 `tsc` 不发生配置错误为证据（`tsconfig.base.json`；来源：`TD-001`、Component 边界；依赖：T001）
- [ ] T004 [P] 配置 TypeScript、React、Node 与测试目录的 ESLint 规则；以 lint script 能扫描全部批准实施目录为证据（`eslint.config.js`；来源：`TD-001`、验证环境责任矩阵；依赖：T001）
- [ ] T005 [P] 忽略依赖、构建、coverage、Playwright、性能临时输出、环境文件和本地 PostgreSQL volume；以列出的本地产物均被 `git check-ignore` 命中为证据（`.gitignore`；来源：`design.md` Component 边界；依赖：T001）
- [ ] T006 [P] 从 image context 排除本地产物、`.git/`、测试报告和 AI Delivery 非运行制品；以 Docker context 检查不含这些路径为证据（`.dockerignore`；来源：`design.md` Component 边界、部署拓扑；依赖：T001）
- [ ] T007 [P] 声明带健康检查和持久 volume 的本地 PostgreSQL 17 服务；以 `docker compose config` 成功且不含真实凭据为证据（`compose.yaml`；来源：`TD-003`、Quickstart、验证环境责任矩阵；依赖：T001）
- [ ] T008 [P] 配置 web、server、contracts 三个 workspace 的构建边界与 Vite 同源静态产物；以三个 workspace 均能被根构建 script 发现为证据（`apps/web/tsconfig.json`、`apps/web/vite.config.ts`、`apps/server/tsconfig.json`、`packages/contracts/tsconfig.json`；来源：`TD-001`、`TD-002`、Component 边界；依赖：T001）

## Phase 2：Foundational

- [ ] T009 [P] 为初始 schema、约束、索引、deferred trigger、migration checksum 与重复执行行为编写 PostgreSQL 17 integration 测试；以测试在 migration 未实现时失败且覆盖无已提交 `processing` 为证据（`tests/integration/migrations.test.ts`；来源：`TD-003`、领域与数据模型、部署拓扑；依赖：T001—T008）
- [ ] T010 [P] 为 UUID、状态枚举、错误 envelope、请求 ID 与 OpenAPI 3.1 生成规则编写共享 contract 测试；以 schema 快照和额外字段拒绝断言为证据（`tests/contract/shared-contract.test.ts`；来源：`TD-009`、Interface 与契约；依赖：T001—T008）
- [ ] T011 [P] 为配置拒绝、1 MiB body limit、安全响应头、日志字段与 secret/任务内容 redaction 编写 focused unit 测试；以缺失生产配置、敏感字段和业务文本样本均被断言为证据（`tests/unit/server-foundation.test.ts`；来源：Constitution 安全约束、`NFR-006`、`NFR-007`、安全与 Secret；依赖：T001—T008）
- [ ] T012 实现只前进的初始 PostgreSQL migration；以 T009 在真实 PostgreSQL 17 上通过为证据（`db/migrations/001_initial.sql`；来源：`TD-003`、`TD-004`、领域与数据模型、部署拓扑；依赖：T009）
- [ ] T013 实现共享 wire types、错误码、JSON Schema 与 OpenAPI 生成入口；以 T010 通过且生成 OpenAPI 3.1 artifact 为证据（`packages/contracts/src/common.ts`、`packages/contracts/src/errors.ts`、`packages/contracts/src/openapi.ts`、`packages/contracts/src/index.ts`；来源：`TD-009`、Interface 与契约；依赖：T010）
- [ ] T014 实现严格配置、数据库连接池、脱敏结构化日志、安全 header 与 Fastify 应用装配基础；以 T011 通过且日志样本不含 secret、标题或说明为证据（`apps/server/src/config.ts`、`apps/server/src/db/pool.ts`、`apps/server/src/logging.ts`、`apps/server/src/security.ts`、`apps/server/src/app.ts`；来源：`TD-001`、治理与技术约束、安全与 Secret、配置与可观测性；依赖：T011—T013）
- [ ] T015 建立真实 PostgreSQL、Fastify、浏览器、故障注入及按需求 ID 输出证据的共用测试夹具；以夹具可独立启动、清理且不记录任务内容或凭据为证据（`tests/helpers/postgres.ts`、`tests/helpers/server.ts`、`tests/helpers/browser.ts`、`tests/helpers/evidence.ts`；来源：验证环境责任矩阵、`NFR-008`、`IQA-011`；依赖：T012—T014）
- [ ] T016 为统一集合冻结锁编写真实 PostgreSQL integration 测试，覆盖普通 mutation 的 shared transaction lock、诊断比对的 exclusive session lock、`finally` 显式释放、shared/shared 并行、exclusive 与 shared 相互等待及释放后继续；以并发连接的阻塞/放行顺序、锁释放和超时清理断言为证据（`tests/integration/collection-freeze-lock.test.ts`；来源：`design.md` 数据流、状态、并发与生命周期及配置、可观测性与运维；依赖：T015）
- [ ] T017 实现供创建、状态变更、删除和业务诊断共同使用的集合冻结 advisory key、shared transaction lock 与 exclusive session lock/release；以 T016 在真实 PostgreSQL 17 上通过且唯一算法路径不存在锁泄漏为证据（`apps/server/src/tasks/collection-freeze-lock.ts`；来源：`design.md` 第 131、192 行集合冻结决策；依赖：T016）

## Phase 3：US1 - 集中查看任务进度

### 测试

- [ ] T018 [P] [US1] 为 `GET /api/v1/tasks`、单项读取、排序、三状态 wire value、普通任务字段和读取错误编写 contract 测试；以运行 server、共享 schema、client 与 OpenAPI 一致为证据（`tests/contract/tasks-read.contract.test.ts`；来源：`US-001`、`FR-001`、`FR-006`、`FR-009`、API contract；依赖：T017）
- [ ] T019 [P] [US1] 为普通任务过滤、稳定排序、完整集合读取和数据库失败映射编写真实 PostgreSQL integration 测试；以 probe 永不出现在普通集合且失败不伪装为空集合为证据（`tests/integration/tasks-read.repository.test.ts`；来源：`US-001`、`FR-001`、`FR-006`、`IQA-001`、`IQA-007`；依赖：T017）
- [ ] T020 [P] [US1] 为加载、空状态、首项创建引导、三列任务及读取失败恢复编写 Playwright functional 测试；以 `IQA-001` 和读取恢复的用户可见记录为证据（`tests/functional/us1-board-read.spec.ts`；来源：`IQA-001`、`IQA-007`、`AC-001`、`AC-007`；依赖：T017）
- [ ] T021 [P] [US1] 编写从空 PostgreSQL 启动同源应用、准备三状态数据并由浏览器完整读取的 end-to-end 场景；以真实 browser/server/database 的任务集合对照为证据（`tests/e2e/us1-board-read.e2e.spec.ts`；来源：`US-001`、`IQA-001`、Constitution 测试要求；依赖：T017）
- [ ] T022 [P] [US1] 为 `loading/empty/loaded/load_error/refreshing` 状态机和最后确认快照保留编写 focused unit 测试；以失败与刷新转换表全部通过为证据（`tests/unit/board-read-state.test.ts`；来源：`FR-006`、`FR-009`、数据流与状态；依赖：T017）

### 实现

- [ ] T023 [US1] 定义任务读取 schema 与 API client 类型并注册到共享导出/OpenAPI；以 T018 的读取 contract 断言通过为证据（`packages/contracts/src/tasks-read.ts`、`packages/contracts/src/index.ts`、`packages/contracts/src/openapi.ts`；来源：`FR-001`、`FR-006`、`FR-009`、API contract；依赖：T018—T022）
- [ ] T024 [US1] 实现并注册普通任务 Repository、读取 service 与 GET routes；以 T018、T019 通过且 SQL 参数化、probe 被过滤为证据（`apps/server/src/tasks/task-repository.ts`、`apps/server/src/tasks/read-tasks.ts`、`apps/server/src/routes/tasks-read.ts`、`apps/server/src/app.ts`；来源：`TD-003`、`FR-001`、`FR-006`、`FR-009`；依赖：T023）
- [ ] T025 [US1] 实现同源读取 client、看板加载/空/三状态/读取错误界面及完整纯文本任务卡；以 T020—T022 通过为证据（`apps/web/index.html`、`apps/web/src/api/tasks.ts`、`apps/web/src/state/board-state.ts`、`apps/web/src/components/Board.tsx`、`apps/web/src/main.tsx`；来源：`US-001`、`FR-001`、`FR-006`、`NFR-007`、`IQA-001`；依赖：T024）

## Phase 4：US2 - 创建任务

### 测试

- [ ] T026 [P] [US2] 为创建请求、首次 `201`、成功重放 `200`、标题错误、operation 引用和同键异请求 `409` 编写 contract 测试（`tests/contract/tasks-create.contract.test.ts`；来源：`US-002`、`FR-002`、`FR-003`、`FR-007`—`FR-009`、API contract；依赖：T017）
- [ ] T027 [P] [US2] 为创建事务、幂等 advisory lock、集合 shared lock、同键并发重放、owner 回滚接管和确定性拒绝记录编写真实 PostgreSQL integration 测试（`tests/integration/tasks-create.repository.test.ts`；来源：`TD-004`、`FR-002`、`FR-003`、`FR-009`、Quickstart、集合冻结决策；依赖：T017）
- [ ] T028 [P] [US2] 为有/无说明创建、空/纯空白/1/120/121 grapheme 标题和可理解反馈编写 Playwright functional 测试（`tests/functional/us2-create-task.spec.ts`；来源：`IQA-002`、`IQA-003`、`AC-002`、`AC-003`；依赖：T017）
- [ ] T029 [P] [US2] 编写浏览器经真实 API 与 PostgreSQL 创建任务并重新读取的 end-to-end 场景；以初始 `pending`、持久内容和成功反馈对照为证据（`tests/e2e/us2-create-task.e2e.spec.ts`；来源：`US-002`、`IQA-002`、`FR-002`、`FR-007`；依赖：T017）
- [ ] T030 [P] [US2] 为 ECMAScript trim、`Intl.Segmenter` grapheme 计数、内部空白保留与说明归一化编写 focused unit 测试（`tests/unit/task-title-validation.test.ts`；来源：`TD-005`、`FR-003`、领域规则；依赖：T017）

### 实现

- [ ] T031 [US2] 定义创建、幂等 operation、replay 和标题错误 schema 并注册到共享导出/OpenAPI；以 T026 通过并更新 OpenAPI artifact 为证据（`packages/contracts/src/tasks-create.ts`、`packages/contracts/src/operations.ts`、`packages/contracts/src/index.ts`、`packages/contracts/src/openapi.ts`；来源：`TD-009`、创建 API contract；依赖：T026—T030）
- [ ] T032 [US2] 实现并注册 grapheme 校验、canonical request hash、幂等事务、统一集合 shared lock 与创建 route；以 T016、T026、T027、T030 通过且无重复 mutation、锁泄漏或遗留 `processing` 为证据（`apps/server/src/tasks/task-validation.ts`、`apps/server/src/idempotency/operation-repository.ts`、`apps/server/src/idempotency/request-hash.ts`、`apps/server/src/tasks/collection-freeze-lock.ts`、`apps/server/src/tasks/create-task.ts`、`apps/server/src/routes/tasks-create.ts`、`apps/server/src/app.ts`；来源：`TD-004`、`TD-005`、`FR-002`、`FR-003`、`FR-009`、集合冻结决策；依赖：T017、T031）
- [ ] T033 [US2] 实现受控创建表单、client 即时校验、服务端权威错误和成功反馈；以 T028、T029 通过且非法输入不改变集合为证据（`apps/web/src/components/CreateTaskForm.tsx`、`apps/web/src/state/create-task.ts`；来源：`US-002`、`FR-002`、`FR-003`、`FR-007`；依赖：T025、T032）

## Phase 5：US3 - 推进任务

### 测试

- [ ] T034 [P] [US3] 为状态变更请求、六向有效值、同状态拒绝、任务不存在和 replay 编写 contract 测试（`tests/contract/tasks-status.contract.test.ts`；来源：`US-003`、`FR-004`、`FR-007`—`FR-009`、API contract；依赖：T017）
- [ ] T035 [P] [US3] 为任务行锁、集合 shared lock、六向事务、版本递增、非目标字段不变和幂等并发编写真实 PostgreSQL integration 测试（`tests/integration/tasks-status.repository.test.ts`；来源：`TD-004`、状态不变量、`FR-004`、`FR-009`、集合冻结决策；依赖：T017）
- [ ] T036 [P] [US3] 为六种状态转换、文字状态、成功反馈和失败后保留确认快照编写 Playwright functional 测试（`tests/functional/us3-change-status.spec.ts`；来源：`IQA-004`、`IQA-007`、`AC-004`、`AC-007`；依赖：T017）
- [ ] T037 [P] [US3] 编写浏览器逐一执行六向转换并由真实 API 重新读取的 end-to-end 场景；以每次唯一新状态和其他任务不变为证据（`tests/e2e/us3-change-status.e2e.spec.ts`；来源：`US-003`、`IQA-004`、`NFR-008`；依赖：T017）
- [ ] T038 [P] [US3] 为允许的目标状态、同状态拒绝和前端转换状态机编写 focused unit 测试（`tests/unit/task-status-transition.test.ts`；来源：`FR-004`、业务状态不变量、`TD-010`；依赖：T017）

### 实现

- [ ] T039 [US3] 定义状态变更与错误 schema 并注册到共享导出/OpenAPI；以 T034 通过并更新 OpenAPI artifact 为证据（`packages/contracts/src/tasks-status.ts`、`packages/contracts/src/index.ts`、`packages/contracts/src/openapi.ts`；来源：`TD-009`、状态 API contract；依赖：T034—T038）
- [ ] T040 [US3] 实现并注册带任务行锁、统一集合 shared lock、幂等记录、版本递增和有界事务重试的状态变更 service 与 route；以 T016、T034、T035、T038 通过为证据（`apps/server/src/tasks/collection-freeze-lock.ts`、`apps/server/src/tasks/change-task-status.ts`、`apps/server/src/routes/tasks-status.ts`、`apps/server/src/app.ts`；来源：`TD-004`、`FR-004`、`FR-007`—`FR-009`、SLO 与重试、集合冻结决策；依赖：T017、T039）
- [ ] T041 [US3] 实现每张卡可选择另外两个状态的原生控件及确定性结果反馈；以 T036、T037 通过且界面不使用 optimistic mutation 为证据（`apps/web/src/components/TaskCard.tsx`、`apps/web/src/state/change-task-status.ts`；来源：`TD-006`、`TD-010`、`US-003`；依赖：T033、T040）

## Phase 6：US4 - 删除任务

### 测试

- [ ] T042 [P] [US4] 为删除首次成功、replay、任务不存在与错误 envelope 编写 contract 测试（`tests/contract/tasks-delete.contract.test.ts`；来源：`US-004`、`FR-005`、`FR-007`—`FR-009`、API contract；依赖：T017）
- [ ] T043 [P] [US4] 为物理删除、任务行锁、集合 shared lock、幂等并发、回滚与 operation 结果编写真实 PostgreSQL integration 测试（`tests/integration/tasks-delete.repository.test.ts`；来源：`TD-004`、状态不变量、`FR-005`、`FR-009`、集合冻结决策；依赖：T017）
- [ ] T044 [P] [US4] 为可识别目标的确认、取消、Esc、焦点约束/归还和确认成功反馈编写 Playwright functional 测试（`tests/functional/us4-delete-task.spec.ts`；来源：`IQA-005`、`AC-005`、`TD-006`；依赖：T017）
- [ ] T045 [P] [US4] 编写取消不发请求及确认后真实数据库任务消失的 end-to-end 场景（`tests/e2e/us4-delete-task.e2e.spec.ts`；来源：`US-004`、`IQA-005`、`FR-005`；依赖：T017）
- [ ] T046 [P] [US4] 为删除确认状态机、目标识别、取消和重复提交抑制编写 focused unit 测试（`tests/unit/delete-confirmation.test.ts`；来源：`FR-005`、`TD-006`、数据流与状态；依赖：T017）

### 实现

- [ ] T047 [US4] 定义删除结果与 replay schema 并注册到共享导出/OpenAPI；以 T042 通过并更新 OpenAPI artifact 为证据（`packages/contracts/src/tasks-delete.ts`、`packages/contracts/src/index.ts`、`packages/contracts/src/openapi.ts`；来源：`TD-009`、删除 API contract；依赖：T042—T046）
- [ ] T048 [US4] 实现并注册带任务行锁、统一集合 shared lock 和幂等 operation 的删除 service 与 route；以 T016、T042、T043 通过且取消路径无服务端 mutation 为证据（`apps/server/src/tasks/collection-freeze-lock.ts`、`apps/server/src/tasks/delete-task.ts`、`apps/server/src/routes/tasks-delete.ts`、`apps/server/src/app.ts`；来源：`TD-004`、`FR-005`、`FR-007`—`FR-009`、集合冻结决策；依赖：T017、T047）
- [ ] T049 [US4] 实现受控可访问删除确认组件和删除反馈状态；以 T044—T046 通过为证据（`apps/web/src/components/DeleteTaskDialog.tsx`、`apps/web/src/state/delete-task.ts`；来源：`TD-006`、`US-004`、`NFR-005`；依赖：T041、T048）

## Phase 7：US5 - 连续可靠地使用看板

### 测试

- [ ] T050 [P] [US5] 为 operation 查询等待、`completed` 对外约束、replay、未知 operation 与 transient failure 编写 contract 测试（`tests/contract/operations-recovery.contract.test.ts`；来源：`US-005`、`FR-008`、`FR-009`、operation API contract；依赖：T017）
- [ ] T051 [P] [US5] 为同键等待、事务回滚接管、集合冻结锁、刷新持久性和应用进程重建后的 PostgreSQL 数据保持编写 integration 测试（`tests/integration/operations-recovery.test.ts`；来源：`TD-004`、`FR-008`、`FR-009`、`NFR-001`；依赖：T017）
- [ ] T052 [P] [US5] 为读取恢复、三类写操作结果未知的已生效/未生效六分支、320/1440 视口、200% 放大、键盘与 axe-core 编写 Playwright functional 测试（`tests/functional/us5-recovery-responsive-accessibility.spec.ts`；来源：`IQA-007`、`IQA-008`、`IQA-010`、`AC-007`、`AC-008`、`AC-010`；依赖：T017）
- [ ] T053 [P] [US5] 编写真实 browser/server/PostgreSQL 下的响应前断连、重新协调、安全原键重试、刷新和本地受控应用重启自动化；输出 8 组持久性映射但不声称完成远程验收（`tests/e2e/us5-continuity-recovery.e2e.spec.ts`；来源：`IQA-006`、`IQA-007`、`IQA-011`、验证环境责任矩阵；依赖：T017）
- [ ] T054 [P] [US5] 为 `idle/submitting/succeeded/failed/unknown/reconciling/applied/not_applied`、sessionStorage key 恢复及禁止虚假成功编写 focused unit 测试（`tests/unit/write-recovery-state.test.ts`；来源：`TD-010`、`FR-007`—`FR-009`、数据流与状态；依赖：T017）

### 实现

- [ ] T055 [US5] 完成并注册 operation 查询、锁等待、canonical replay 与 transient failure schema/route；以 T050、T051 通过为证据（`packages/contracts/src/operation-query.ts`、`packages/contracts/src/index.ts`、`packages/contracts/src/openapi.ts`、`apps/server/src/idempotency/query-operation.ts`、`apps/server/src/routes/operations.ts`、`apps/server/src/app.ts`；来源：`TD-004`、`FR-009`、operation API contract；依赖：T050—T054）
- [ ] T056 [US5] 实现写操作未知结果协调、最后确认快照、sessionStorage 未决 key、安全原键重试和可理解恢复反馈；以 T052—T054 通过且已生效分支不重复 mutation 为证据（`apps/web/src/state/write-recovery.ts`、`apps/web/src/components/OperationFeedback.tsx`；来源：`FR-007`—`FR-009`、`NFR-002`、`TD-010`；依赖：T049、T055）
- [ ] T057 [US5] 实现三列到纵向布局、完整文本、安全纯文本呈现、键盘焦点和 ARIA live 样式；以 T052 的视口、放大、键盘、axe-core 与特殊文本断言通过为证据（`apps/web/src/styles/board.css`、`apps/web/src/styles/accessibility.css`；来源：`FR-010`、`NFR-003`、`NFR-005`、`NFR-007`、`TD-006`；依赖：T056）

## Phase 8：US6 - 了解运行状态

### 测试

- [ ] T058 [P] [US6] 为 live、ready、business 的状态码、响应 enum、受影响能力和禁止任务内容字段编写 contract 测试（`tests/contract/health.contract.test.ts`；来源：`US-006`、`FR-011`、健康 API contract；依赖：T017）
- [ ] T059 [P] [US6] 为诊断专用锁、集合冻结 exclusive lock/摘要比对、与 mutation shared lock 的并发等待、锁释放、probe 隔离、CRUD 与 `finally` 清理编写真实 PostgreSQL integration 测试（`tests/integration/business-diagnostics.test.ts`；来源：`TD-007`、`FR-011`、配置与可观测性、集合冻结决策；依赖：T017）
- [ ] T060 [P] [US6] 为全正常、请求拒绝、读取失败和三类写入部分失效的整体判定及内容保护编写 functional 测试（`tests/functional/us6-business-health.spec.ts`；来源：`IQA-009`、`AC-009`、`SC-006`；依赖：T017）
- [ ] T061 [P] [US6] 编写 loopback 穿过真实 Fastify hooks/schema、真实 PostgreSQL probe CRUD 且普通 API 不可见的 end-to-end 场景（`tests/e2e/us6-business-health.e2e.spec.ts`；来源：`FR-011`、`IQA-009`、`TD-007`；依赖：T017）
- [ ] T062 [P] [US6] 为诊断能力聚合、15 秒总 deadline、constant-time token 校验和脱敏响应编写 focused unit 测试（`tests/unit/business-diagnostics.test.ts`；来源：`NFR-006`、配置与可观测性、`TD-007`；依赖：T017）

### 实现

- [ ] T063 [US6] 定义三类健康响应与固定受影响能力 schema 并注册到共享导出/OpenAPI；以 T058 通过并更新 OpenAPI artifact 为证据（`packages/contracts/src/health.ts`、`packages/contracts/src/index.ts`、`packages/contracts/src/openapi.ts`；来源：`TD-009`、健康 API contract；依赖：T058—T062）
- [ ] T064 [US6] 实现并注册 live、migration-aware ready、使用统一集合 exclusive lock/release 的 loopback 业务诊断、普通集合摘要比对、内部 probe CRUD 和清理 routes；以 T016、T058—T062 通过且响应/日志均无任务内容、摘要、token 或凭据为证据（`apps/server/src/tasks/collection-freeze-lock.ts`、`apps/server/src/diagnostics/business-diagnostic.ts`、`apps/server/src/diagnostics/probe-context.ts`、`apps/server/src/routes/health.ts`、`apps/server/src/app.ts`；来源：`TD-007`、`FR-011`、`NFR-006`、配置与可观测性、集合冻结决策；依赖：T017、T063）

## Phase 9：Polish

- [ ] T065 [P] 编写按 0/500 任务量及 10 个独立组各 100 样本采集、排序并输出第 95 个值的可执行性能工具；以本地校准输出保留组别、序号、起止点和阈值字段且不声称最终性能通过为证据（`tests/performance/task-board-performance.ts`；来源：`NFR-004`、`IQA-010`、验证环境责任矩阵；依赖：T064）
- [ ] T066 [P] 建立 `INT/FR/NFR/AC/IQA` 到 contract、integration、functional、end-to-end 与 unit 自动化的逐项机器可读映射；以 `NFR-008` 必测项无缺口且不记录虚构执行结果为证据（`tests/evidence/requirements-map.json`；来源：`NFR-008`、`IQA-011`、`AC-011`；依赖：T064）
- [ ] T067 [P] 为 migration 必须先于接流量且失败时禁止启动、终止信号停止接收并排空在途请求、入口 HTML 禁止长期缓存、哈希静态资源长期缓存及未知非 API 路径 SPA fallback 编写先行 integration 测试；以各生命周期事件、响应 header、fallback 内容、真实 stdout/stderr 和退出码断言为证据（`tests/integration/server-lifecycle-static.test.ts`；来源：`TD-002`、`design.md` 第 37、133、208—214 行、部署拓扑、Quickstart；依赖：T064）
- [ ] T068 实现 migration 与 server 启动入口、终止信号排空、静态资源缓存策略及同源 SPA fallback；以 T067 全部通过且本地启动后 API、SPA、live、ready、business 同端口工作为证据（`apps/server/src/db/migrate.ts`、`apps/server/src/server.ts`、`apps/server/src/static-assets.ts`；来源：`TD-002`、部署拓扑、Quickstart；依赖：T067）
- [ ] T069 构建固定 Node 24.x patch、非 root runtime、仅含生产依赖和构建产物的 multi-stage OCI image；以本地 `docker build` 成功且 image history/环境不含 secret 为证据（`Dockerfile`；来源：部署拓扑、Constitution 交付治理；依赖：T065—T068）
- [ ] T070 编写并执行 Candidate 容器运行验证：启动 PostgreSQL 17、使用同一 image 完成 migration、启动并在 `finally` 清理 Candidate 容器，断言 `/health/live`、migration-aware `/health/ready`、`/health/business` 及诊断前后 `/api/v1/tasks` 均不暴露 probe；以每条原始命令、真实 stdout/stderr、退出码和容器清理结果为证据（`tests/container/candidate-runtime.sh`；来源：Quickstart 容器验证、`TD-002`、`TD-003`、`TD-007`、健康 API contract；依赖：T069）
- [ ] T071 声明幂等 clean-runner setup 与唯一分类的 `staticAnalysis`、`build`、`developerTests`、`integrationTests`、`functionalTests` 非空命令数组，并纳入 T067 与 T070 的可执行验证；以 schema 校验及逐类原样执行成功、保留真实 stdout/stderr 与退出码为证据（`.ai-delivery/features/001-delivery-dlv-20261111-f5de284ee4bb/runtime/deployment.json`；来源：`design.md` 部署拓扑、Quickstart、平台 runtime contract；依赖：T070）

## 完成证据

- Setup 与 Foundational：保留 lockfile 一致性、配置解析、真实 PostgreSQL 17 migration、共享 contract、配置拒绝、日志脱敏和测试夹具清理的命令、真实 stdout/stderr 与退出码。
- `US-001`—`US-006`：每个故事保留对应 contract、PostgreSQL integration、Playwright functional、真实 browser/server/database end-to-end 与 focused unit 的独立执行记录，并关联任务中列出的需求、场景和验收标准。
- Coding 必须产出 `NFR-008`/`IQA-011` 的逐项自动化映射、8 组刷新与本地辅助重启脚本、六个结果未知恢复分支、视口/放大/axe-core 辅助结果、性能采样工具、生命周期/静态交付 integration 证据、`Dockerfile`、Candidate 容器运行验证和 `runtime/deployment.json`；本地结果不得冒充远程验收。
- 平台 CI 后续针对不可变 Candidate 重跑分类命令；远程受控服务重启、真实故障注入、10 组最终性能、完整 WCAG 2.2 AA、精确 Candidate 部署、Independent QA、UAT、发布审批、Review 与 Merge 均保留为下游证据，不是本清单任务的完成前置条件。
