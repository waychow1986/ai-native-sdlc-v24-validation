# 最小状态页实施任务

## 任务规则

- 每项任务使用格式：`- [ ] T001 [P?] [US?] 描述（准确仓库路径）`
- 每项任务必须引用来源 Intent、Specification 场景、Contract 或技术决策。
- 测试任务必须位于对应生产实现任务之前。
- `npm test` 是唯一强制的 `developerTests` 聚合入口，必须串行执行 unit、component、contract、integration、functional 和 Playwright end-to-end 套件；定向测试执行仅作为 test-first 辅助证据，不能替代聚合结果。
- CI、部署、Independent QA、UAT、发布、Review 和 Merge 结果属于下游平台证据。

## 依赖关系

- Phase 1 完成后才能开始 Phase 2；T002 依赖 T001，T003～T006 可在 T001 后并行；T003 在 `package.json` 内完成 lint 配置和 `check` 聚合后，T036 才能声明该 clean runner 静态分析入口。
- Phase 2 是全部用户故事的阻塞前置条件；T009 依赖 T007～T008。
- US1、US2、US3 均为 P1，但按产品状态旅程依次实施：Phase 3 依赖 T009，Phase 4 依赖 T018，Phase 5 依赖 T025。
- 每个用户故事内先完成全部测试任务，再开始该故事的生产实现；同一测试文件的后续修改显式依赖其较早任务。
- Phase 6 依赖全部用户故事实现完成；T034 依赖 T033，T035 依赖 T034，T036 依赖 T002、T003、T006、T035。

## Phase 1：Setup

- [x] T001 按 TD-001、TD-010 和 Quickstart 固定 Node.js 24、TypeScript 5.9、React 19、Vite 7、Fastify 5、Vitest、Playwright、axe-core、ESLint 及适配 TypeScript/React 的 lint 依赖与项目脚本，确保 `check`、`build`、`test` 使用 lockfile 安装的本地 CLI，且 `test` 串行聚合 unit、component、contract、integration、functional 与 Playwright end-to-end 测试（`package.json`；来源：TD-001、TD-010、验证环境责任矩阵、Quickstart 1～5；依赖：无；完成证据：manifest 中的固定版本、本地 CLI、lint 依赖与强制聚合全部六类测试套件的 script 声明可审查）
- [x] T002 根据 T001 生成并提交可供 `npm ci` 在 clean runner 复现的完整 npm lockfile（`package-lock.json`；来源：TD-010、Quickstart 1；依赖：T001；完成证据：`npm ci` 严格使用 lockfile 的安装输出）
- [x] T003 [P] 配置客户端、服务端和测试所需的严格 TypeScript no-emit 边界，并在 manifest 内配置覆盖 `src/`、`tests/`、`vite.config.ts` 的 TypeScript/React lint 规则、零 warning 失败策略以及先 TypeScript 后 lint 的串行 `check` 聚合，禁止运行时临时安装工具（`tsconfig.json`、`package.json`；来源：TD-001、验证环境责任矩阵、Quickstart 3 及其 `npm run check` 契约；依赖：T001；完成证据：clean runner 经 T002 安装后执行 `npm run check`，保留 TypeScript no-emit 与项目 lint 两段真实 stdout/stderr 和统一退出码，任一失败均使聚合非零退出）
- [x] T004 [P] 配置 React 构建、服务端构建、测试环境及生产静态产物边界，不增加 client-side 业务路由（`vite.config.ts`；来源：TD-001、TD-010、页面与静态协议；依赖：T001；完成证据：`npm run build` 生成约定客户端和服务端产物）
- [x] T005 [P] 忽略 `node_modules/`、`dist/`、`coverage/`、`playwright-report/`、`test-results/` 和 `.env*`，且不新增 `.env.example`（`.gitignore`；来源：Component 边界与项目结构；依赖：T001；完成证据：本地输出与环境文件均不进入 Git 候选变更）
- [x] T006 [P] 从容器构建上下文排除本地输出、`.git/` 和 `.ai-delivery/`（`.dockerignore`；来源：Component 边界与项目结构、TD-010；依赖：T001；完成证据：容器构建上下文不包含所列目录）

## Phase 2：Foundational

- [x] T007 [P] 先编写配置、结构化日志白名单、请求体上限、安全响应头、未知 API 错误、优雅退出和非法配置非零退出的定向单元测试（`tests/unit/server-foundation.test.ts`；来源：TD-008、配置/可观测性与运维、安全/隐私/身份与 Secret；依赖：T002、T003；完成证据：测试在实现前可执行并逐项断言批准的服务边界）
- [x] T008 [P] 先编写 `GET /health/live` 与 `GET /health/ready` 的 `204`、空响应、无环境详情及非产品隔离 contract test（`tests/contract/health.test.ts`；来源：运维接口、验证环境责任矩阵；依赖：T002、T003；完成证据：Fastify `inject` contract test 覆盖两个健康端点）
- [x] T009 实现可注入的 Fastify 应用、严格配置解析、白名单日志、安全/错误处理、健康路由、监听与优雅退出，暂不实现产品页面和状态 API（`src/server/app.ts`、`src/server/index.ts`、`src/server/routes/health.ts`；来源：TD-002、TD-008、数据流/状态/并发与生命周期、运维接口；依赖：T007、T008；完成证据：T007～T008 通过且非法 `PORT`、`LOG_LEVEL`、`TRUST_PROXY` 被拒绝）

## Phase 3：US1 - 查看最小状态页

### 测试

- [x] T010 [P] [US1] 先编写首页与静态协议 contract test，覆盖 `GET /`、单一挂载点、未知非 API 路径 `404`、CSP 和禁止额外业务页面（`tests/contract/page.test.ts`；来源：US-001、FR-001、FR-007、AC-001、AC-008、页面与静态协议；依赖：T009；完成证据：Fastify `inject` 对页面、header 和路由边界的断言）
- [x] T011 [P] [US1] 先编写真实本地 Fastify 进程与浏览器 Fetch 的 integration test，确认打开首页只发起一次同源 `GET /api/status` 且结果未决时保持处理中（`tests/integration/page-loading.test.ts`；来源：US-001、FR-002、AC-002、IQA-001；依赖：T009；完成证据：真实 HTTP 请求记录与处理中 DOM 断言）
- [x] T012 [P] [US1] 先编写页面范围、标题、单一状态区域、处理中语义、无登录/写入/导航和基础 axe 规则的 functional test（`tests/functional/page-loading.test.tsx`；来源：US-001、FR-001～FR-002、FR-007、NFR-003～NFR-006、AC-001～AC-002、AC-009～AC-010；依赖：T009；完成证据：用户可见 DOM、键盘与自动化可访问性断言）
- [x] T013 [P] [US1] 先编写 IQA-001 对应的 Playwright end-to-end 场景，保留页面打开、请求、标题、单一状态区域、处理中状态和 2 秒页面主体边界的 trace/screenshot 能力（`tests/e2e/status-page.spec.ts`；来源：IQA-001、NFR-001、AC-001～AC-002、AC-011；依赖：T009；完成证据：真实本地应用与 Chromium 的原始时间和浏览器证据）
- [x] T014 [P] [US1] 先编写 `loading` 初始状态、唯一当前状态、卸载中止和旧 generation 不更新页面的 focused unit/component test（`tests/component/App.test.tsx`；来源：US-001、FR-002、TD-004、状态不变量 1、2、5；依赖：T009；完成证据：确定性的 reducer、AbortController 和 DOM 状态断言）

### 实现

- [x] T015 [P] [US1] 创建唯一应用挂载点和客户端入口，不写入额外可见内容或 inline script/style（`index.html`、`src/client/main.tsx`；来源：US-001、FR-001、NFR-006、页面与静态协议；依赖：T010～T014；完成证据：T010、T012、T013 的挂载与范围断言通过）
- [x] T016 [US1] 实现标题“最小流程验证”、唯一 live status region、初始/未决“正在获取状态”、generation reducer 和卸载清理（`src/client/App.tsx`；来源：US-001、FR-001～FR-002、TD-004、AC-001～AC-002；依赖：T010～T015；完成证据：T012～T014 通过）
- [x] T017 [P] [US1] 实现最小响应式页面样式、非颜色状态表达及清晰的 `:focus-visible` 基础样式，不增加装饰性业务内容（`src/client/styles.css`；来源：NFR-004、NFR-006、TD-006、AC-010；依赖：T010～T015；完成证据：T012 的范围与自动化可访问性断言通过）
- [x] T018 [US1] 让 Fastify 同源提供构建后的唯一首页及静态资源，并接入页面首次状态请求生命周期（`src/server/app.ts`、`src/client/status-client.ts`；来源：FR-002、TD-001、架构概览 1～2、页面与静态协议；依赖：T016、T017；完成证据：T010～T014 全部通过且首页无额外 route）

## Phase 4：US2 - 查看成功状态

### 测试

- [ ] T019 [P] [US2] 先编写 `GET /api/status` wire contract test，覆盖精确 `200`、JSON media type、`{"status":"ok"}`、禁止附加字段、`Cache-Control: no-store`、非 GET `405`/`Allow: GET`、未知 API `404` 和稳定无敏感错误 body（`tests/contract/status.test.ts`；来源：US-002、FR-002～FR-003、AC-003、产品接口 Contract；依赖：T018；完成证据：Fastify `inject` 对 status、header 和精确 body 的逐项断言）
- [ ] T020 [P] [US2] 先编写真正启动 Fastify 后由 `status-client` 发出同源请求并只接受精确成功 schema 的 integration test（`tests/integration/status-success.test.ts`；来源：US-002、TD-003、架构概览 2～3、IQA-002；依赖：T018；完成证据：真实 HTTP server、浏览器 Fetch adapter 和 DOM 成功转换记录）
- [ ] T021 [P] [US2] 先编写首次成功旅程的 functional test，验证处理中后仅显示区分大小写的“ok”、无重试按钮、无自动刷新或第二成功值（`tests/functional/status-success.test.tsx`；来源：US-002、FR-003、FR-007、AC-003、AC-008、IQA-002；依赖：T018；完成证据：完整用户可见成功状态及范围边界断言）
- [ ] T022 [US2] 在现有 Playwright 文件中先追加 IQA-002 成功 end-to-end 场景及 3 秒状态门禁、单次请求和无刷新证据（`tests/e2e/status-page.spec.ts`；来源：IQA-002、NFR-001～NFR-002、AC-003、AC-011～AC-012；依赖：T013、T018；完成证据：真实本地应用的请求、状态转换、耗时和最终“ok”记录）
- [ ] T023 [US2] 在现有 component 测试中先追加当前 generation 成功、精确 schema 接受及非 200/媒体类型/JSON/schema 拒绝的 focused unit test（`tests/component/App.test.tsx`；来源：US-002、TD-003～TD-005、状态不变量 2～3；依赖：T014、T018；完成证据：adapter 解析矩阵与 reducer 成功转换断言）

### 实现

- [ ] T024 [US2] 实现并注册唯一产品路由及 schema、安全缓存和稳定错误 contract（`src/server/routes/status.ts`、`src/server/app.ts`；来源：FR-002～FR-003、TD-003、产品接口 Contract；依赖：T019～T023；完成证据：T019～T020 通过）
- [ ] T025 [US2] 实现严格响应解析、2500 ms 超时、当前 generation 成功提交和“ok”成功视图，不增加自动重试或成功后刷新（`src/client/status-client.ts`、`src/client/App.tsx`；来源：FR-002～FR-003、TD-004～TD-005、AC-003、AC-008；依赖：T019～T024；完成证据：T020～T023 通过）

## Phase 5：US3 - 从状态获取失败中人工恢复

### 测试

- [ ] T026 [P] [US3] 先编写 Fetch adapter 失败 contract test，覆盖网络失败、2500 ms 超时、非 200、错误 media type、无效 JSON、schema 不匹配、Abort 和不泄露内部错误（`tests/contract/status-client.test.ts`；来源：US-003、FR-004～FR-006、TD-005、外部 adapter Contract；依赖：T025；完成证据：每类失败均归一化且无技术错误进入用户结果）
- [ ] T027 [P] [US3] 先编写真实本地进程中浏览器请求被阻断、解除阻断后通过页面按钮恢复、连续失败再恢复的 integration test（`tests/integration/status-recovery.test.ts`；来源：US-003、TD-007、IQA-003～IQA-005；依赖：T025；完成证据：真实请求 abort/恢复、每次按钮对应单次新请求及完整状态转换）
- [ ] T028 [P] [US3] 先编写失败提示、唯一重试按钮、键盘/焦点、live/alert 感知、无敏感内部内容、无自动重试和连续失败边界的 functional test（`tests/functional/status-recovery.test.tsx`；来源：US-003、FR-004～FR-007、NFR-003～NFR-006、AC-004～AC-010、IQA-003～IQA-007；依赖：T025；完成证据：用户可见失败、重试、隐私、范围和 axe/键盘断言）
- [ ] T029 [US3] 在现有 Playwright 文件中先追加 IQA-003～IQA-005、IQA-008 的失败、重试成功、连续失败恢复 end-to-end 场景，记录每次 3 秒门禁、成功/失败/恢复 3/3 和无自动请求（`tests/e2e/status-page.spec.ts`；来源：IQA-003～IQA-005、IQA-008、NFR-001～NFR-002、AC-004～AC-012；依赖：T022、T025；完成证据：同一本地验证对象的 trace、screenshot、原始时间及请求计数）
- [ ] T030 [US3] 在现有 Playwright 文件中先追加 IQA-006 的正常、失败和重试完整旅程内容/操作清单与最小权限、隐私和范围外操作断言，并追加 IQA-007 的 axe-core、仅键盘重试、焦点可见、处理中/成功/失败状态可感知及非纯颜色自动化输入（`tests/e2e/status-page.spec.ts`；来源：IQA-006～IQA-007、FR-007、NFR-003～NFR-004、AC-009～AC-010、TD-006；依赖：T029；完成证据：真实本地应用与 Chromium 的三类旅程、axe、键盘、焦点及状态感知记录；人工辅助技术 WCAG 结论留给 Independent QA）
- [ ] T031 [US3] 在现有 component 测试中先追加失败、人工重试、连续失败、递增 generation、处理中禁用重复请求及迟到响应丢弃的 focused unit test（`tests/component/App.test.tsx`；来源：US-003、FR-004～FR-006、TD-004、状态不变量 1～5；依赖：T023、T025；完成证据：reducer、DOM 和并发边界的确定性断言）

### 实现

- [ ] T032 [US3] 实现统一失败归一化、失败提示、唯一原生重试按钮、按钮触发的新 generation、重试处理中状态、连续失败可恢复及迟到结果防护（`src/client/status-client.ts`、`src/client/App.tsx`；来源：FR-004～FR-006、TD-004～TD-007、AC-004～AC-007；依赖：T026～T031；完成证据：T026～T031 通过且每次人工操作只产生一次请求）

## Phase 6：Polish

- [ ] T033 先在现有 functional 测试中追加 320～1440 CSS 像素、200% 放大、焦点可见和非纯颜色断言，验证标题、状态与适用的重试操作不丢失（`tests/functional/page-loading.test.tsx`、`tests/functional/status-recovery.test.tsx`；来源：NFR-004、TD-006、AC-010、IQA-007；依赖：T032；完成证据：样式收口前可执行的 viewport、zoom、焦点与非颜色验收断言）
- [ ] T034 按已批准安全边界完成跨故事样式收口，确保焦点可见、状态不只依靠颜色且在 320～1440 CSS 像素和 200% 放大下不丢失标题、状态或重试操作（`src/client/styles.css`；来源：NFR-004、TD-006、AC-010、IQA-007；依赖：T033；完成证据：T030、T033 的 axe-core、键盘、焦点、viewport 与 zoom 自动化结果通过；人工辅助技术结论留给 Independent QA）
- [ ] T035 创建固定 Node 24 基础 image digest 的 multi-stage production image，使用非 root 用户且仅包含 production dependencies 和构建产物，并以 `PORT=3000` 启动编译后的 Fastify 服务（`Dockerfile`；来源：TD-002、TD-010、安全/隐私/身份与 Secret、部署拓扑；依赖：T034；完成证据：使用本地 OCI-compatible runtime 完成 image 构建及非 root、端口、页面、API、liveness/readiness smoke）
- [ ] T036 声明幂等 `developerSetupCommands` 为 `npm ci`、`npx --no-install playwright install --with-deps chromium`，并仅声明非空分类 `staticAnalysis`=`npm run check`、`build`=`npm run build`、`developerTests`=`npm test`，同时记录根 Dockerfile、container port `3000` 及健康路径（`.ai-delivery/features/002-delivery-dlv-20261111-b5e3df2255f5/runtime/deployment.json`；来源：治理与技术约束、验证环境责任矩阵、Quickstart；依赖：T002、T003、T006、T035；完成证据：schema 校验通过，命令非 no-op、类别内唯一，且可在 clean runner 按序执行包含 TypeScript no-emit 与项目 lint 的 `npm run check`）

## 完成证据

- Setup 与 Foundational：在 clean runner 保留 `npm ci`、`npm run check` 的真实 stdout/stderr 和退出码；`npm run check` 必须串行输出 TypeScript no-emit 与项目 lint 结果，lockfile 安装、类型、lint、安全配置、健康 contract 任一失败即停止。
- 每个用户故事：保留 unit、component、contract、integration、functional 和 Playwright end-to-end 测试的真实结果；这些测试的最终通过证据必须来自 T001 定义的 `npm test` 强制聚合，定向执行只作为 test-first 辅助证据；浏览器场景使用本地真实 Fastify 进程，并保留可归属本地构建的请求记录、trace、screenshot 与原始计时。
- Coding 总体验证：按 Quickstart 顺序执行 `npm ci`、`npx --no-install playwright install --with-deps chromium`、`npm run check`、`npm run build`、`npm test`；其中 `npm run check` 必须串行执行 TypeScript no-emit 与项目 lint，`npm test` 必须串行执行 unit、component、contract、integration、functional 和 Playwright end-to-end 全部六类测试，任一检查缺失或失败均停止，且不在失败后安装未声明 package。
- Candidate 就绪：提交根 `Dockerfile` 与本迭代 `runtime/deployment.json`，供平台 CI 构建并验证同一不可变 image；Coding 不声称已获得 registry digest、远程部署、QA target、Independent QA、UAT、发布审批、Review 或 Merge 结果。
- Independent QA 输入：Playwright 自动化必须支持真实成功、浏览器网络阻断失败、解除阻断后人工重试、连续失败恢复、唯一计时边界、axe-core 和键盘/焦点证据；人工辅助技术 WCAG 2.2 AA 结论及精确 Candidate 的远程结果由 Independent QA 产生。
