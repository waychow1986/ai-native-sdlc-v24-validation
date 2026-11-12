# 最小状态页技术方案

## 实施就绪状态

`implementationReady: true`

## 技术上下文（Technical Context）

- 仓库当前只有 Delivery 制品和项目说明，尚无应用源代码、构建配置、容器定义或既有运行时约束；Coding 将按本方案建立最小单体应用。
- 产品是一个无登录、无数据库、无外部业务集成的单页状态页。浏览器打开 `/` 后只调用同源 `GET /api/status`，页面在处理中、成功、失败三个可见状态间转换；失败后只能由用户手动重试。
- 采用 Node.js 24 LTS（Coding 时锁定受支持的精确 24.x patch 与容器 digest）、TypeScript 5.9、React 19、Vite 7、Fastify 5。Fastify 在同一进程和同一源提供静态前端、REST/JSON API 与运维健康端点，交付为单一 OCI image。
- 前端状态仅存在于当前浏览器内存；服务端状态接口是无状态固定响应，不持久化数据。运行时不需要 PostgreSQL、其他数据库、消息系统、对象存储或外部服务。
- 使用 npm 与已提交的 `package-lock.json` 复现依赖。开发者与 CI 使用 Vitest、Fastify `inject`、Playwright 和 axe-core 分别完成静态、component/API、浏览器功能与自动化可访问性验证；人工辅助技术检查保留给 Independent QA。
- 应用监听 `0.0.0.0:${PORT}`，`PORT` 缺省为 `3000`。容器以非 root 用户运行，并提供 `/health/live` 与 `/health/ready` 运维端点；二者不是产品接口，不在页面中暴露。
- 部署目标是平台提供的、支持 OCI image、HTTPS 入口、健康探测、不可变 Candidate 标识与回滚的受管理容器环境。具体 provider、资源名称、域名和凭据是部署输入，不影响 Coding；当前批准材料没有授权新增特定云产品。

## 治理与技术约束

- 已批准范围要求最简单架构且明确排除数据库和外部业务系统，因此采用单进程、同源、无持久化架构；不采用技术基线候选中与本 Feature 无关的 PostgreSQL、Key Vault 或云专属组件。
- 凭据必须留在服务端且支持时使用 managed identity；本应用自身不需要业务凭据。部署平台若需要拉取 image 或终止 TLS，由平台身份负责，任何值均不得进入前端 bundle、仓库或日志。
- 输入校验与 least privilege 落实为：产品 API 只接受 `GET`，无请求体、参数或业务输入；容器非 root；文件系统和网络权限限制为启动及监听端口所需权限。
- 不记录 secret、客户内容或个人信息。应用日志不采集请求/响应 body、header、cookie、查询值、客户端 IP 或页面状态文本，只记录允许的运行元数据。
- 每项用户可见能力均由可独立执行场景覆盖。Mock 和 component test 仅提供开发反馈；精确 Candidate 的成功、真实请求失败、恢复、性能及 WCAG 2.2 AA 结果由 Independent QA 在部署环境产生。
- Coding 沙箱不得访问 Azure、云资源、远程环境、托管身份、网络或 RBAC；Coding 只验证本地进程和本地容器。云端部署与环境控制归平台 CI 和 Independent QA。
- `.github/workflows/` 由 AIDelivery Hub 管理，本方案不创建或修改该目录。Production candidate 必须包含根目录 `Dockerfile` 和本迭代 `runtime/deployment.json`，且部署 image、Candidate SHA 与 QA target 必须指向同一不可变 Candidate。
- `runtime/deployment.json` 必须声明幂等 `developerSetupCommands`，以及仅按 `staticAnalysis`、`build`、`developerTests` 三个必选类别组织的非空 `developerValidationCommands`；本 Feature 不把远程验收伪装成 Coding 命令。具体命令见快速验证指南。
- 所有用户可见行为严格来自 INT-001～INT-015、FR-001～FR-007、NFR-001～NFR-006 与 AC-001～AC-012；运维端点、测试工具和容器配置不增加页面功能。

## 架构概览（Architecture）

系统采用同源模块化单体：

1. 浏览器请求 `/`，Fastify 返回 Vite 构建的静态 HTML、JavaScript 和 CSS。
2. React 根组件立即将唯一状态区域置为 `loading`，并通过浏览器 `fetch` 发起一次 `GET /api/status`。
3. Fastify 状态路由返回固定 JSON `{"status":"ok"}`。前端只有在收到满足契约的 `200` JSON 后转为 `success`；其他 HTTP 状态、网络错误、超时、JSON 解析失败或 schema 不匹配均转为 `failure`。
4. `failure` 状态显示简短失败提示和一个原生按钮。按钮触发一次新请求并立即回到 `loading`；应用不自动重试、不自动刷新、不保存历史。
5. Fastify 的健康端点只服务部署探针。应用没有数据库或外部依赖，readiness 在进程完成路由和静态资源注册并开始监听后成功。

前端、API 与静态资源同源，避免 CORS、跨服务追踪和分布式故障。单一 OCI image 在所有下游阶段复用，Candidate 通过 Git SHA 与 image digest 双重识别。

## 技术决策与替代方案

| 决策 ID | 选择 | 理由 | 已考虑替代方案 | 来源 |
|---|---|---|---|---|
| TD-001 | Node.js 24 LTS + TypeScript 5.9 + React 19 + Vite 7 + Fastify 5 | 采用技术基线首选栈的适用部分；前后端共享语言、单进程同源交付，足以实现最小交互 | .NET 10 可行但增加第二套前端工具链；纯静态页无法在同一 Candidate 内提供指定 API | 技术基线；FR-001～FR-006 |
| TD-002 | 单一无状态 OCI container，不使用数据库或外部业务服务 | 固定状态无需持久化，且数据库与外部集成明确在范围外 | PostgreSQL、SQLite、serverless function 均增加无批准依赖或部署单元 | INT-004、INT-009；FR-007 |
| TD-003 | 同源 REST/JSON `GET /api/status`，响应为 `{"status":"ok"}` | 保留客户指定路径并提供最小、严格、可测试的 wire contract | 纯文本会降低 schema 明确性；GraphQL、event 或第二接口扩大范围 | INT-012；FR-002～FR-003 |
| TD-004 | React reducer 管理 `loading/success/failure` 判别联合；每次请求使用递增 generation 和独立 `AbortController` | 使转换、不变量和迟到响应处理确定，防止旧请求覆盖当前状态 | 多状态布尔值容易产生冲突；状态管理 library 对单组件过重 | FR-002～FR-006；业务不变量 2、4、5 |
| TD-005 | 单次请求 2500 ms 客户端超时，不做自动重试 | 为 3 秒用户可见门禁预留渲染与测量余量；超时仍按失败处理并保留人工恢复 | 无超时可能永远停留处理中；自动重试违反规格 | NFR-001；FR-004～FR-006；AC-008、AC-011 |
| TD-006 | 原生语义元素、可见 `:focus-visible`、状态 live region、非颜色文本，并使用 axe-core 加人工 WCAG 验证 | 直接覆盖键盘、焦点、状态感知和 WCAG 2.2 AA | 自定义可点击元素增加键盘与语义风险 | NFR-004；AC-010 |
| TD-007 | Independent QA 通过浏览器网络层阻断真实 `GET /api/status` 请求，再解除阻断后点击重试 | 在不增加产品故障开关或外部依赖的前提下，让精确 Candidate 经历真实网络失败和恢复 | 测试专用产品端点或 query 参数会扩大产品 contract；mock 响应不能替代验收 | IQA-003～IQA-005；NFR-002 |
| TD-008 | Fastify 默认结构化日志经白名单过滤，前端不发送 telemetry | 提供最小运行诊断且不记录客户内容或敏感值 | 外部 telemetry backend 未获批准；完整请求日志可能泄露信息 | NFR-003；Constitution 安全约束 |
| TD-009 | 平台无关的受管理容器部署，HTTPS 在平台入口终止 | 当前没有批准 provider 或资源标识；OCI contract 足以完成 Coding 与不可变部署 | Azure/AWS/GCP 专属服务留作平台映射，不纳入 Feature 架构 | 技术基线；INT-014 |
| TD-010 | npm lockfile、multi-stage Docker build、最终 image 仅含生产依赖与构建产物 | 支持 clean runner 和可复现 Candidate，减少运行面 | 将开发服务器用于生产不提供合适的静态交付与进程边界 | 交付治理；NFR-001 |

## 领域与数据模型

### 浏览器状态

`StatusViewState` 是仅存于单个页面实例内存的判别联合：

- `loading`：含当前 `generation`；显示“正在获取状态”，不显示成功、失败或重试按钮。
- `success`：含 `generation` 和精确值 `"ok"`；显示且仅显示业务成功值“ok”，不显示重试按钮。
- `failure`：含 `generation`；显示“状态获取失败，请重试”和唯一“重试”按钮，不保留或展示内部错误详情。

初始 React render 直接进入 `loading` 并启动 generation 1。`generation` 仅用于并发防护，不展示、不记录、不持久化。不存在用户、凭据、任务、历史、计数或其他业务实体。

### API 模型

`StatusResponse`：

| 字段 | 类型 | 必需 | 约束 |
|---|---|---|---|
| `status` | JSON string | 是 | 唯一允许值为区分大小写的 `"ok"` |

响应对象禁止附加字段。没有请求模型、数据库 schema 或 migration。

### 状态不变量

1. `loading`、`success`、`failure` 任一时刻恰有一个为当前状态。
2. 只有当前 generation 的有效成功响应可进入 `success`。
3. 所有未取得有效 `StatusResponse` 的结果进入 `failure`，且用户界面不显示技术错误。
4. 只有 `failure` 中的按钮操作可创建下一 generation；没有 timer、后台轮询或自动重试。
5. 页面卸载时中止当前请求；已中止或旧 generation 的完成结果不得更新页面。

## Component 边界与项目结构

Coding 获准创建或修改的根路径清单如下：

- `./.dockerignore`
- `./.gitignore`
- `./Dockerfile`
- `./index.html`
- `./package.json`
- `./package-lock.json`
- `./tsconfig.json`
- `./vite.config.ts`
- `src/`
- `tests/`
- `.ai-delivery/features/002-delivery-dlv-20261111-b5e3df2255f5/runtime/`

建议结构：

```text
src/
├── client/
│   ├── App.tsx
│   ├── main.tsx
│   ├── status-client.ts
│   └── styles.css
└── server/
    ├── app.ts
    ├── index.ts
    └── routes/
        ├── health.ts
        └── status.ts
tests/
├── component/
│   └── App.test.tsx
├── contract/
│   └── status.test.ts
└── e2e/
    └── status-page.spec.ts
```

- `src/client/` 只负责页面呈现、请求 lifecycle 和可访问交互，不读取 secret 或部署配置。
- `src/server/app.ts` 构造可由测试注入的 Fastify 实例；`index.ts` 只处理配置校验、监听和优雅退出。
- `src/server/routes/status.ts` 独占产品 API；`health.ts` 独占非产品运维探针。
- `tests/component/` 验证 reducer 和 DOM 状态，`tests/contract/` 使用 Fastify `inject` 验证 wire contract，`tests/e2e/` 用真实本地服务和浏览器验证用户旅程。
- `.gitignore` 必须忽略 `node_modules/`、`dist/`、`coverage/`、`playwright-report/`、`test-results/`、`.env*`，但允许提交无 secret 的 `.env.example`（本 Feature 不需要该文件）。`.dockerignore` 同时排除这些本地输出、`.git/` 和 `.ai-delivery/`。
- `runtime/deployment.json` 记录 Candidate build、端口、健康端点和规定的开发者命令；它不复制本文产品内容。

## 数据流、状态、并发与生命周期

1. **启动**：服务校验 `PORT` 为合法监听端口，注册安全头、静态文件、API、健康端点和错误处理器，然后监听。配置错误立即以非零码退出。
2. **首次获取**：React mount 创建 generation 1 和 `AbortController`，先呈现 `loading`，再调用 `fetch("/api/status", {method:"GET", headers:{"Accept":"application/json"}, signal})`。
3. **成功**：仅当 HTTP 为 `200`、媒体类型为 `application/json` 且 body 精确满足 schema 时提交当前 generation 的 `success("ok")`。
4. **失败**：非 200、错误媒体类型、无效 JSON、schema 不匹配、网络异常或 2500 ms 超时统一提交当前 generation 的 `failure`。失败原因不进入 DOM。
5. **人工重试**：`failure` 的按钮单次激活后同步创建下一 generation、清除旧失败视图并进入 `loading`；处理中不渲染按钮，因此不能并发发起重复请求。
6. **迟到结果**：提交结果前同时检查组件仍挂载、generation 仍为当前值且 signal 未中止，否则丢弃。
7. **退出**：收到 `SIGTERM`/`SIGINT` 后停止接受新连接，等待 Fastify 管理的在途请求完成并退出；本应用无待刷新的业务状态。

服务端没有业务写入、事务、cache 或跨副本状态。多个容器副本可独立返回相同结果，不要求会话亲和。API 本身不做重试。

## Interface 与契约（Contract）

### 产品接口

`GET /api/status`

- 请求：无 path 参数、query、request body、cookie 或认证要求；`Accept: application/json`。
- 成功：`200 OK`，`Content-Type: application/json; charset=utf-8`，body 精确为 `{"status":"ok"}`。
- 方法错误：该路径的非 `GET` 方法返回 `405` 和 `Allow: GET`；错误 body 使用通用 `{"error":"method_not_allowed"}`。
- 其他服务器错误：返回 `500` 和 `{"error":"status_unavailable"}`；不得包含 stack、内部消息、secret 或请求内容。
- 未知 `/api/*` 路径：`404` 和 `{"error":"not_found"}`。
- 版本：已批准路径不增加 URL 版本段；当前 schema 是版本 1。向响应增加字段、改变大小写、媒体类型或成功值均是破坏性产品变更，必须先更新已批准 Specification，而不能由 Coding 自行兼容。
- 缓存：响应设置 `Cache-Control: no-store`，保证每次首次加载和人工重试都产生一次新请求。

Fastify route schema 同时约束响应和序列化。contract test 必须覆盖状态码、header、精确 JSON、无附加字段、no-store、非 GET 与未知 API 错误。

### 页面与静态协议

- `GET /` 返回唯一首页；不配置业务 client-side route。未知非 API 路径返回普通 `404`，不产生额外页面导航能力。
- `index.html` 仅包含应用挂载点和构建资源；可见 DOM 由一个 `main` 组成，其中有一个 `h1`“最小流程验证”和一个语义状态区域。
- 状态区域使用稳定的命名容器；状态文本通过 `role="status"`/`aria-live="polite"` 感知，失败提示可使用 `role="alert"`，但同一时刻只渲染一个结果。重试使用原生 `button type="button"`。
- 处理和失败文案为“正在获取状态”“状态获取失败，请重试”；成功业务文本精确为“ok”。样式不以颜色作为唯一信号。

### 运维接口

- `GET /health/live`：进程事件循环可响应时返回 `204 No Content`。
- `GET /health/ready`：应用已完成初始化并可处理静态页面与状态路由时返回 `204 No Content`。
- 运维端点不返回配置、版本、依赖或环境详情，不被前端调用。因无外部依赖，readiness 不执行网络检查。

### 外部 adapter 与 contract test

唯一运行时 adapter 是浏览器 Fetch API；`status-client.ts` 隔离 HTTP 解析、超时和错误归一化。测试可在 component 层替换该 adapter，但必须另以真实 Fastify 进程执行 Playwright 场景。不存在第三方业务 adapter。

## 安全、隐私、身份与 Secret

- 产品无登录、身份、角色或业务授权；部署入口访问条件由平台提供且不是本 Feature 的页面能力。应用不得推断或记录用户身份。
- Fastify 拒绝状态路径上的 request body 和非 GET 方法；全局请求体上限设为 16 KiB 作为非产品错误流保护，产品 API 的有效 body 大小始终为 0。
- 使用参数化数据库查询不适用，因为没有数据库。应用不执行 shell、不接收文件、不渲染服务端用户输入。
- 前端只把编译期静态代码发布给浏览器。所有以 `VITE_` 暴露的环境配置均视为公开；本 Feature 不定义此类配置，也不需要 secret。
- 响应设置严格 CSP：`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`，并设置 `X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer` 和禁止不必要 browser permissions 的 `Permissions-Policy`。生产资源不得依赖 inline script/style。
- TLS 由部署入口提供并强制 HTTPS；应用仅信任平台明确配置的 proxy hop。没有批准配置时不采信转发 header。
- production image 使用固定 digest 的 Node 24 基础 image、非 root 用户、只包含运行产物和 production dependencies；CI 对 lockfile 和 image 进行既有安全扫描。
- 日志白名单字段为时间、level、服务事件、方法、规范化 route、HTTP status、duration、内部 request ID。禁止 body、响应内容、header、cookie、query、IP、user-agent、stack 的生产输出；异常只映射为稳定错误类别。

## 配置、可观测性与运维

配置仅包含：

| 名称 | 来源 | 缺省 | 规则 |
|---|---|---|---|
| `PORT` | 容器环境 | `3000` | 1～65535 的整数；非法值启动失败 |
| `LOG_LEVEL` | 容器环境 | `info` | 仅允许 `error`、`warn`、`info`；非法值启动失败 |
| `TRUST_PROXY` | 容器环境 | `false` | 仅由已知平台拓扑显式设为批准 hop；不接受任意布尔字符串或全信任 |

不使用 `.env` 作为生产配置，不存在业务 secret。平台必须在部署前验证配置并将 Candidate SHA 与 image digest 作为部署元数据，而不是页面内容。

应用将结构化日志写到 stdout/stderr，由平台保留和采集；本 Feature 不指定或新增外部日志 backend、留存期、告警产品或支持流程。最低诊断事件为启动成功、配置拒绝、优雅退出和按规范化 route 汇总的请求完成。健康探针和部署平台状态是运行可见性来源。

## SLO、限制、扩缩容、重试与恢复

- **页面门禁**：从验收用户发出打开首页操作，到标题与唯一状态区域首次同时可见且区域处于处理中/成功/失败之一（失败时重试可操作）不超过 2 秒。
- **状态门禁**：每次首次或人工重试触发请求，到状态区域进入成功或失败不超过 3 秒；2500 ms 客户端超时确保无响应请求在门禁内进入失败。
- **可靠性**：不承诺长期可用率。对同一精确 Candidate 的成功、失败、恢复各执行一次，必须 3/3 通过。
- **请求限制**：产品 API 无 body、参数或分页；单页面实例最多有一个在途状态请求。规格没有批准用户数、吞吐量或副本数目标，因此不虚构容量门禁。
- **扩缩容**：服务无状态，可由部署平台在已批准资源边界内水平扩展，无 session affinity。扩缩容策略和上下限由部署环境提供，不写入产品 contract。
- **重试**：浏览器、服务端和基础设施不得为产品状态获取执行自动 retry；只有失败视图中的用户操作可重试。部署平台可按其既有健康管理重启不健康容器，但不得将重启表现为成功业务结果。
- **恢复**：单实例故障通过容器重启或替换恢复；无业务数据需要恢复。持续失败时用户得到明确失败状态，不降级为缓存或伪造“ok”。

## 部署拓扑、迁移、Rollout 与 Rollback

CI 使用 lockfile 在 clean runner 构建前端和服务端，运行必需验证，再通过 multi-stage `Dockerfile` 产生单一 OCI image。image 以 Candidate Git SHA 标记并发布不可变 digest。受管理容器环境从该 digest 启动一个或多个相同实例；HTTPS 入口将 `/`、`/api/status` 和健康探针路由到同一应用，外部不需要数据库或其他服务。

首次部署没有数据 migration。后续版本也不得因当前方案预建数据库；如果未来批准持久化需求，必须另行设计 migration。应用启动不执行 schema 变更。

Rollout 使用平台支持的滚动替换：新实例只有 `/health/ready` 成功后才接收流量；失败则停止 rollout。发布验证必须确认实际 QA URL 指向预期 image digest 和 Candidate SHA。Rollback 重新部署上一已知通过的不可变 image digest；由于无数据变化，不需要数据回滚。不得原地修改已发布 image。

具体 provider、资源标识符、域名、TLS 证书和平台入口配置由部署阶段注入。缺少这些运行值是部署前置条件，不是 Coding 或本方案的产品阻塞。

## 验证环境责任矩阵（Verification Environment）

| 验证类型 | 责任阶段 | 环境来源 | 依赖/凭据 | Coding 证据 | 下游结果 |
|---|---|---|---|---|---|
| 静态分析与 lockfile 安装 | Coding / 平台 CI | clean Node.js 24 runner | npm registry；无业务凭据 | `npm ci`、TypeScript 检查与 lint 原始输出 | CI 对提交 SHA 的重复结果 |
| Component 与 API contract | Coding / 平台 CI | 本地 Fastify `inject`、Vitest DOM | 无外部服务、无凭据 | 状态转换、不变量、精确 API/error/header contract 测试结果 | CI 对精确 Candidate 的测试结果 |
| 本地浏览器功能 | Coding / 平台 CI | 本地真实 Fastify 进程 + Playwright Chromium | 平台安装的 browser/runtime；无云凭据 | 首次成功、请求阻断失败、解除阻断后重试、连续失败恢复、无自动重试的 trace/screenshot 与测试结果 | CI 重跑同一场景的结果；不能替代 Independent QA |
| 本地容器 smoke | 平台 CI | 从根 `Dockerfile` 构建的 Candidate image | 本地 container runtime | image 启动、非 root、端口、页面、API、liveness/readiness 结果 | 已发布 image digest 与 Candidate SHA 关联 |
| 部署完整性 | 远程部署 | 平台提供的受管理容器 integration 环境 | 平台部署身份、HTTPS 入口、Candidate image digest | `runtime/deployment.json`、Dockerfile、健康 contract | QA target 指向同一不可变 Candidate 的部署记录 |
| 用户功能与可靠性 | Independent QA | 已部署精确 Candidate；浏览器网络阻断/恢复能力 | QA URL；无需应用凭据，平台访问凭据如有则由 QA 保管 | IQA-001～IQA-006、IQA-008 自动化脚本和证据采集能力 | 真实成功、失败、恢复 3/3、四类用户场景及唯一计时边界结果 |
| WCAG 2.2 AA | Independent QA | 同一 QA target、支持键盘与辅助技术的浏览器环境 | QA URL；axe-core 与人工辅助技术 | axe 自动化规则、键盘与焦点测试 | IQA-007 的自动加人工 WCAG 2.2 AA 结论与原始证据 |
| 发布核验 | release verification | 指向已验收 digest 的候选发布环境 | 只读部署元数据和目标 URL | Candidate SHA、digest、QA target 对应关系 | 发布目标未漂移、健康与最小成功旅程结果 |

Independent QA 的失败场景必须让浏览器发出的真实请求发生网络失败，不得用伪造 `200`、替换成功 body 或测试专用产品 API 代替。每条证据须包含 Candidate SHA、image digest、目标 URL、原始时间戳和场景结果。

## 快速验证指南（Quickstart）

前置条件是受支持的 Node.js 24 LTS、npm 和用于容器 smoke 的 OCI-compatible runtime。Coding 完成后按以下顺序验证：

1. `npm ci`
2. `npx --no-install playwright install --with-deps chromium`
3. `npm run check`
4. `npm run build`
5. `npm test`

`npm run check` 必须执行 TypeScript no-emit 检查与项目 lint；`npm run build` 必须生成前端静态产物和可执行服务端产物；`npm test` 必须串行聚合 component、API contract 和本地 Playwright 功能测试，任一失败即非零退出。Playwright 启动真实本地应用，通过路由 abort 形成网络失败，随后解除 abort 并只用页面“重试”按钮验证恢复。

`runtime/deployment.json` 的 `developerSetupCommands` 依次声明 `npm ci` 和 `npx --no-install playwright install --with-deps chromium`；`npx --no-install` 只执行 lockfile 已安装的本地 Playwright CLI，不临时解析或安装其他 package。`developerValidationCommands` 精确声明：

- `staticAnalysis`: `npm run check`
- `build`: `npm run build`
- `developerTests`: `npm test`

每类使用非空字符串数组，命令在类别内唯一且不是 no-op；平台必须先完整校验声明，再执行 setup，并按上述类别顺序在首次失败时停止。该文件同时声明 image 由根 `Dockerfile` 构建、container port 为 `3000`、liveness 为 `/health/live`、readiness 为 `/health/ready`。

本地手工观察时启动应用并访问 `http://localhost:3000/`：应先看到标题和“正在获取状态”，随后唯一状态区域显示“ok”。开发者工具离线或 Playwright 网络阻断应得到失败提示和一个重试按钮；恢复网络后点击该按钮应先回到处理中，再显示“ok”。这类本地结果只能作为开发证据。

## 支持 Runbook

- **页面无法打开**：先核对目标 URL、Candidate SHA/image digest、容器状态和 `/health/live`；若 image 身份不符，停止验证并修正部署指向，不在实例内热修。
- **readiness 失败**：检查配置拒绝和启动事件。由于无外部依赖，不应通过添加数据库或外部服务解决；配置正确仍失败时回滚上一不可变 image。
- **页面可开但状态失败**：检查浏览器中 `GET /api/status` 的状态码/网络结果、平台路由和规范化服务日志。不得要求用户提供敏感 header，也不得在日志中临时开启 body、IP 或客户内容采集。
- **性能门禁失败**：按 NFR-001 唯一起止点保留 browser trace，区分静态资源、API 与渲染耗时；不得以虚假成功、放宽计时或自动重试规避。
- **无障碍失败**：保留 axe 规则、键盘步骤、焦点与辅助技术证据，在同一 Candidate 上复现；不得只以颜色或截图判定修复。
- **失败后恢复异常**：确认每次按钮操作只产生一个新 `GET /api/status`、状态先回到处理中、旧 generation 未覆盖新结果；禁止加入自动 retry。
- **回滚**：部署上一已知通过的 image digest，等待 readiness，通过最小成功旅程后记录目标、digest 与时间。没有数据 migration 或数据恢复步骤。
- **升级**：Node、TypeScript、React、Vite、Fastify 或测试依赖升级必须更新 lockfile、重建 image 并重跑完整开发者验证和 Independent QA；Node 24 退出支持前必须通过新的 technical baseline 决定后继版本。

## 开放决策

无。
