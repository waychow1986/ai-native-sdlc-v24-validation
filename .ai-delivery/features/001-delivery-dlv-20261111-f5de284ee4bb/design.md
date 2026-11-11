# 团队任务看板技术方案

## 实施就绪状态

`implementationReady: true`

## 技术上下文（Technical Context）

当前仓库除 AI Delivery 制品与项目说明外没有应用代码、既有数据或既有运行时约束。本次从空仓库实现一个单一部署单元的 Web 应用：React 单页前端由 Fastify 同源提供，Fastify 同时提供版本化 REST/JSON API，PostgreSQL 保存任务、幂等操作结果和业务诊断状态。该边界覆盖 `FR-001`—`FR-011`，不引入账户、权限、外部业务系统、编辑、搜索或其他范围外能力。

技术栈固定为 Node.js 24 LTS（构建时锁定并在开发、CI 与容器中统一使用同一最新受支持 24.x patch）、TypeScript 5.9、React 19、Vite 7、Fastify 5、`node-postgres` 和 PostgreSQL 17。依赖由 npm lockfile 固定；浏览器端只使用同源 HTTPS API。生产物是一个 Linux OCI image，进程监听 `0.0.0.0:3000`，静态资源和 API 共用该端口。

系统容量验收边界为 0—500 个现存任务。该数字只用于规格规定的性能验证，不作为拒绝第 501 个任务的产品配额。任务说明没有获批的领域长度上限；HTTP 请求体设置 1 MiB 传输安全上限，超限以明确的传输错误拒绝，不把该限制表述为任务业务规则。

部署目标所需的云 provider、landing zone、资源标识符和平台身份尚未由已批准输入指定，因此本设计不创建新的外部云产品。应用以标准 OCI、PostgreSQL 连接和 HTTP 健康契约保持平台可移植；远程环境必须提供受管理的 PostgreSQL 17、TLS 入口、单次 migration 执行能力、持久 secret 注入和不可变 image 部署能力。若交付平台随后提供 Azure 资源，部署适配可映射到技术基线建议的 Azure Container Apps 与 Azure Database for PostgreSQL Flexible Server，而不改变应用契约。

## 治理与技术约束

- Constitution 要求保持产品范围并采用满足可衡量需求的最简单架构。本设计采用单服务、单数据库和同源前后端，不拆分微服务、不增加消息系统、缓存、账户或外部业务 integration。
- 凭据仅存在于服务端。数据库连接信息通过进程环境引用平台 secret，绝不进入前端 bundle、仓库、日志、测试 fixture 或错误响应；数据库角色仅具有应用 schema 的连接、读写和 sequence 权限。支持 workload identity/无密码 PostgreSQL 身份的平台应优先采用该方式，否则由平台 secret store 注入短期连接凭据。
- 用户输入在服务端再次校验，SQL 全部参数化，React 仅以文本节点呈现标题和说明。日志只记录 request ID、路由模板、状态码、耗时、错误代码和不含业务内容的 task ID，不记录标题、说明、请求体、凭据或完整 URL 查询值。
- 每项用户可见能力必须具有可独立执行的验收场景。开发者自动化覆盖 API、真实 PostgreSQL integration 和浏览器功能行为；Mock 只用于制造客户端网络中断，不能替代真实数据库、真实浏览器和部署后验收。
- Coding 沙箱不得访问云资源。Coding 使用本地 PostgreSQL 容器；平台 CI 使用临时 PostgreSQL；受管理数据库、受控服务重启、远程故障注入、最终性能、完整 WCAG 2.2 AA 和精确 Candidate 验证由下游环境承担。
- `.github/workflows/` 由平台拥有，本实现不得修改。生产候选必须提供根目录 `Dockerfile` 和 active Feature 下的 `runtime/deployment.json`，其中 setup 与 validation 命令按平台规定分类声明。
- 技术基线中的 Option A 被采纳为应用实现栈；Azure 仅保留为部署映射，不在没有获批 provider 的情况下变成外部依赖。Option B 与 Option C 不进入实现。

## 架构概览（Architecture）

浏览器加载 Fastify 提供的版本化静态资源。React 应用维护“最后一次已确认的服务端快照”、当前加载状态、输入上下文和每项待确认操作；它不把 optimistic mutation 当作业务最终结果。所有读取和写入通过 `/api/v1` 完成。Fastify 使用 JSON Schema 校验传输结构，再由领域层执行 Unicode 标题规则、状态转换和错误映射。Repository 层通过 `node-postgres` 参数化 SQL 与 PostgreSQL 交互。

看板固定呈现“待处理”“进行中”“已完成”三个带文字标题的区域；宽屏使用三列，窄屏与 200% 放大时按同一顺序纵向排列。创建表单始终可由键盘到达；每张任务卡显示完整标题、非空说明、文字状态、可选择另外两个状态的原生控件和删除按钮。删除使用具有初始焦点、焦点约束、Esc 取消和焦点归还的模态确认；成功、失败与结果未知反馈通过可见消息和适当的 ARIA live region 发布，状态不依赖颜色表达。

每个写请求携带客户端生成的 UUID `Idempotency-Key`。服务端在同一数据库事务中锁定幂等键、变更任务并保存不含任务内容的操作结果。响应丢失时，客户端先查询操作结果并重新读取任务集合；只有操作记录不存在且当前集合证明未生效时，才以原键重试。这样在不引入队列或分布式事务的前提下满足 `FR-009`。

Fastify 暴露进程存活、依赖就绪和业务诊断三类状态。业务诊断在专用 advisory lock 下创建带内部探针标记的任务，依次验证读取、状态变更、删除及重新读取，并保证普通任务 API 永不返回探针数据；任何断言、清理或超时失败均返回“不可用”。诊断响应只包含整体状态、受影响能力、检查时间和相关性 ID。

应用启动时只验证配置和数据库连接，不在多副本中自动迁移。部署流程在接流量前以同一 image 单独运行 migration；成功后再启动应用副本。静态资源使用内容哈希和长期缓存，入口 HTML 禁止长期缓存，以避免新旧前后端 contract 混用。

## 技术决策与替代方案

| 决策 ID | 选择 | 理由 | 已考虑替代方案 | 来源 |
|---|---|---|---|---|
| TD-001 | Node.js 24 LTS、TypeScript 5.9、React 19、Vite 7、Fastify 5 | 单语言、单进程实现空仓库中的小型 CRUD，减少构建与运行复杂度 | .NET 10 + React：类型与工具成熟但增加第二套工具链；未选 | 技术基线、`FR-001`—`FR-011` |
| TD-002 | 单一 OCI image，同源提供 SPA 与 REST/JSON | 避免 CORS、服务拆分和分布式一致性；保留桌面与移动端同等能力 | 前后端独立部署：没有独立扩缩容需求；未选 | Constitution、`FR-010` |
| TD-003 | PostgreSQL 17、显式 SQL migration、`node-postgres` | 事务、持久化、行锁和真实重启验证直接支持已确认结果 | SQLite + 持久卷：限制副本与平台文件锁；内存存储：不能满足重启持久性 | `FR-008`、`NFR-001` |
| TD-004 | UUID 幂等键、操作表、事务提交和重新读取协调结果未知 | 允许在响应丢失后判断是否生效并安全重试，不依赖客户端猜测 | 仅重试 HTTP：会重复创建；optimistic UI：会制造虚假成功 | `FR-009`、`NFR-002` |
| TD-005 | `Intl.Segmenter('und', {granularity:'grapheme'})` 计数字素簇，ECMAScript `trim()` 去首尾空白 | 与“用户可感知字符”和空白规则一致，Node 24 无需额外 Unicode 库 | UTF-16 code unit/code point：会误计组合字符 | `FR-003`、领域规则 |
| TD-006 | React 受控表单、语义 HTML、CSS Grid/Flex 响应式布局、原生 dialog 语义的受控确认组件 | 以最少依赖覆盖 320—1440 像素、200% 放大、键盘与屏幕阅读器 | 拖拽作为唯一状态操作：依赖精细指点且不利于可访问性；未选 | `FR-005`、`FR-010`、`NFR-003`、`NFR-005` |
| TD-007 | 普通 API 隐藏的持久化诊断任务执行真实 CRUD | 验证真实业务链路且不向团队成员展示探针内容 | 只查数据库连接：不能满足 `FR-011`；对普通任务执行探针：会污染看板 | `FR-011`、`NFR-006` |
| TD-008 | 平台中立 OCI + PostgreSQL 部署契约 | 已批准输入未指定云 provider，避免擅自新增外部产品，同时保持下游部署可执行 | 立即固定 Azure/AWS/GCP：缺少批准的 landing zone 与资源约束 | 技术基线、Constitution |
| TD-009 | API contract 由共享 TypeScript schema 定义，OpenAPI 3.1 在构建时生成并做兼容性检查 | 前后端、contract test 与运行接口使用单一结构来源 | 手写多份类型：容易漂移；GraphQL：对固定 CRUD 范围过重 | `FR-001`—`FR-011` |
| TD-010 | 不使用前端 optimistic mutation；成功响应后重新读取或采用带版本的服务端结果 | 反馈始终对应已提交结果，网络不确定时保持最后确认快照 | 先移动卡片再回滚：会暂时表达未经确认的结果 | `FR-007`、`FR-009`、`NFR-002` |

## 领域与数据模型

### Task

| 字段 | 类型与约束 | 说明 |
|---|---|---|
| `id` | UUID，主键，由服务端 `crypto.randomUUID()` 生成 | 稳定、不含业务内容的任务标识 |
| `title` | `text`，服务端校验 trim 后 1—120 个 grapheme cluster | 持久化 trim 后的值，内部空白原样保留 |
| `description` | nullable `text` | 未提供或空字符串统一存为 `NULL`；非空内容原样保存并作为纯文本呈现 |
| `status` | PostgreSQL enum/check：`pending`、`in_progress`、`completed` | 分别映射“待处理”“进行中”“已完成” |
| `is_probe` | boolean，默认 `false` | 仅业务诊断使用；普通 API 所有查询强制 `false` |
| `created_at` | `timestamptz`，数据库生成 | 提供稳定展示排序 |
| `updated_at` | `timestamptz`，每次状态变化更新 | 用于服务端结果版本与诊断，不作为用户功能 |
| `version` | bigint，从 1 开始递增 | 响应快照版本；不承诺规格外的并发编辑协调 |

普通任务按 `created_at ASC, id ASC` 返回；每项仅有一个状态。状态变更只允许当前值到另外两个枚举值，目标与当前相同返回确定性 validation error，不修改数据。删除物理删除任务；本范围没有归档、恢复或历史。

### IdempotentOperation

| 字段 | 类型与约束 | 说明 |
|---|---|---|
| `key` | UUID，主键 | 对应 `Idempotency-Key` |
| `kind` | `create_task`、`change_status`、`delete_task` | 操作类型 |
| `request_hash` | SHA-256 | 对规范化 method、path 和 body 求摘要，防止同键复用不同请求 |
| `task_id` | UUID | 目标或已创建任务 ID |
| `outcome` | `succeeded` | 只在业务 mutation 同一事务提交时存在 |
| `result_status` | nullable task status | 状态变更结果；不保存标题或说明 |
| `created_at` | `timestamptz` | 诊断和稳定读取使用 |

操作记录与业务结果具有相同生命周期并持久保留，以保证刷新和服务重启后的恢复；当前范围不提供对外清理策略。相同 key 与相同请求返回原确定性结果，不重复 mutation；相同 key 与不同 request hash 返回 `409 IDEMPOTENCY_KEY_REUSED`。

### 状态不变量

- 创建事务插入 `pending` 任务和对应操作记录；任一插入失败则全部回滚。
- 状态事务锁定目标普通任务，验证目标状态不同，更新状态、时间和版本并插入操作记录；其他字段不变。
- 删除事务锁定目标普通任务，删除任务并插入操作记录；取消删除完全停留在浏览器，不发送 DELETE。
- probe 数据始终带 `is_probe=true`，不会进入普通读取、单项读取、任务计数或性能验收数据。
- 数据库唯一约束、check constraint 和领域校验共同保证枚举、幂等键及 probe 隔离；migration 与应用版本必须匹配。

## Component 边界与项目结构

已批准的实施根路径清单：

- `./package.json`
- `./package-lock.json`
- `./.nvmrc`
- `./tsconfig.base.json`
- `./eslint.config.js`
- `./Dockerfile`
- `./.dockerignore`
- `./.gitignore`
- `./compose.yaml`
- `apps/web/`
- `apps/server/`
- `packages/contracts/`
- `db/migrations/`
- `tests/`
- `.ai-delivery/features/001-delivery-dlv-20261111-f5de284ee4bb/runtime/deployment.json`

`apps/web/` 包含 React 页面、状态协调、API client、可访问组件和响应式样式；不得直接理解数据库字段。`apps/server/` 分为 HTTP adapter、application service、domain validation、PostgreSQL repository、diagnostics 与配置入口。`packages/contracts/` 保存共享 schema、枚举、错误码和 OpenAPI 生成入口，不保存运行时 secret。`db/migrations/` 保存只前进、带编号的 SQL migration。`tests/` 分为 unit、PostgreSQL integration、contract、Playwright functional、performance 和 accessibility 测试及证据映射。

`.gitignore` 必须忽略 `node_modules/`、`dist/`、`coverage/`、Playwright 输出、性能原始临时输出、`.env*`（保留无凭据的 `.env.example` 时显式例外）和本地 PostgreSQL volume。`.dockerignore` 排除相同本地产物、`.git/`、测试报告和 AI Delivery 非运行制品。任何测试证据不得包含任务真实内容或 secret。

## 数据流、状态、并发与生命周期

首次加载时 UI 进入 `loading`，成功后保存服务端完整快照；空数组进入带创建引导的 `empty`，读取失败进入 `load_error`，不得显示空看板。重新获取期间保留最后确认快照并明确标识正在刷新；只有新快照成功后替换。

写操作状态为 `idle → submitting → succeeded | failed | unknown → reconciling → applied | not_applied`。`succeeded` 仅来自服务端确定性成功响应；连接中断、客户端超时或无法解析响应进入 `unknown`，不改变最后确认快照。协调先以幂等键查询操作：存在成功记录时重新获取任务/集合并显示已生效；不存在时重新获取集合并按 task ID、目标状态或删除目标判断未生效，再开放使用原 key 的安全重试。协调本身失败则保持 `unknown` 并仅提供“重新检查”，不开放新操作。

Fastify 每个请求从连接池获取连接。单任务 mutation 使用数据库事务与 `SELECT ... FOR UPDATE`；不同任务可并发，针对同一任务的提交按锁获取顺序串行。规格没有批准冲突解决承诺，因此 API 返回事务完成时的权威结果，客户端随后重新读取；不存在的任务返回确定性 `404`。数据库连接池每实例上限由部署配置提供，默认实现值为 10；该值是可调运行参数而非产品承诺。

浏览器生成写操作 key 并在该次未决操作完成前保存在 `sessionStorage`，刷新后可继续协调；不在浏览器持久化任务内容。服务重启不影响 PostgreSQL 中任务及操作记录。应用收到终止信号后停止接收新请求、等待在途请求完成至平台终止窗口并关闭连接池；未提交事务由数据库回滚。

## Interface 与契约（Contract）

所有业务 API 使用 `/api/v1`、`application/json; charset=utf-8` 和 HTTPS。时间为 RFC 3339 UTC，ID 为 UUID，状态 wire value 固定为 `pending | in_progress | completed`。响应增加 `X-Request-Id`；写请求必须提供 UUID 格式 `Idempotency-Key`。不支持的字段由 schema 拒绝，避免静默接受未来语义。

### API

| Method 与路径 | 请求 | 成功响应 | 追踪 |
|---|---|---|---|
| `GET /api/v1/tasks` | 无 body | `200 {"data":{"tasks":Task[]}}` | `FR-001`、`FR-006`、`FR-009` |
| `GET /api/v1/tasks/{id}` | UUID path | `200 {"data":{"task":Task}}` | 结果未知协调 |
| `POST /api/v1/tasks` | header 幂等键；`{"title":string,"description"?:string}` | `201 {"data":{"task":Task,"operation":OperationRef}}`；重放为 `200` | `FR-002`、`FR-003`、`FR-007`—`FR-009` |
| `PATCH /api/v1/tasks/{id}/status` | header 幂等键；`{"status":TaskStatus}` | `200 {"data":{"task":Task,"operation":OperationRef}}` | `FR-004`、`FR-007`—`FR-009` |
| `DELETE /api/v1/tasks/{id}` | header 幂等键；无 body | `200 {"data":{"deletedTaskId":uuid,"operation":OperationRef}}` | `FR-005`、`FR-007`—`FR-009` |
| `GET /api/v1/operations/{key}` | UUID path | `200 {"data":{"operation":OperationRef}}` 或 `404 OPERATION_NOT_FOUND` | `FR-009` |
| `GET /health/live` | 无 body | 进程事件循环可响应时 `200 {"status":"alive"}` | 部署存活检查 |
| `GET /health/ready` | 无 body | migration 版本匹配且数据库可查询时 `200 {"status":"ready"}`，否则 `503` | 部署接流量门禁 |
| `GET /health/business` | 无 body | `200/503 {"status":"available"|"unavailable","affectedCapabilities":string[],"checkedAt":string,"correlationId":string}` | `FR-011` |

`Task` 只含 `id,title,description,status,createdAt,updatedAt,version`，绝不暴露 `is_probe`。`OperationRef` 只含 `key,kind,taskId,outcome,resultStatus,createdAt`，不含标题或说明。

错误统一为：

```json
{
  "error": {
    "code": "TITLE_REQUIRED",
    "message": "标题不能为空。",
    "field": "title",
    "requestId": "uuid"
  }
}
```

`400` 用于 `TITLE_REQUIRED`、`TITLE_TOO_LONG`、`INVALID_STATUS`、`STATUS_UNCHANGED`、`INVALID_REQUEST`；`404` 用于 `TASK_NOT_FOUND`、`OPERATION_NOT_FOUND`；`409` 用于 `IDEMPOTENCY_KEY_REUSED`；`413` 用于 `REQUEST_BODY_TOO_LARGE`；`500` 为不暴露内部信息的意外错误；`503` 为依赖或业务诊断不可用。客户端对 unknown 只依据 operation/task 重新读取，不依据通用 `5xx` 猜测结果。

OpenAPI 3.1 文档由共享 schema 生成并作为构建 artifact，不提供带调试数据的生产交互页。contract test 验证前后端 client、运行 server 与 OpenAPI 一致；`/api/v1` 内只允许向后兼容地增加可选响应字段，破坏性变更必须进入 `/api/v2`。数据库 schema 不是外部 contract。

本功能没有 event、webhook 或外部业务 adapter。PostgreSQL 是唯一运行时 adapter；其 contract 由 migration checksum、Repository integration test、事务隔离与 PostgreSQL 17 真实实例验证。

## 安全、隐私、身份与 Secret

产品不实现登录、用户识别、差异化权限或任务级访问控制；所有能到达业务入口的团队成员拥有相同能力。部署平台负责 HTTPS 终止和限定应用可达范围，但该平台边界不被宣称为产品身份功能。

Fastify 启用严格 CSP（默认仅自身来源，禁止 object 与 frame，脚本只允许构建产物）、`X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer` 和 frame 禁止策略。静态资源不使用内联可执行用户内容。React 默认 escaping 保持不绕过，不使用 `dangerouslySetInnerHTML`；数据库查询均参数化。标题和说明不写入日志、metric label、错误详情或健康响应。

请求体限制为 1 MiB；JSON schema 限制字段类型、禁止额外字段，并校验 UUID 和状态枚举。标题规则在共享 client schema 提供即时反馈，但服务端是权威校验。错误堆栈只进入受控 server stderr 且经过 redaction，不返回浏览器；生产日志关闭请求/响应 body。

数据库凭据通过 `DATABASE_URL_FILE` 指向只读挂载文件，或通过平台支持的 workload identity 获取；不允许把明文 `DATABASE_URL` 写入 image、仓库或前端。CI 使用短生命周期测试数据库凭据。应用数据库角色不得创建数据库或管理角色；migration 使用独立部署身份，运行身份不能执行 DDL。

## 配置、可观测性与运维

启动时严格校验 `NODE_ENV`、`PORT`、数据库连接来源、连接池大小、statement timeout 和当前 schema version；缺失或非法配置使进程退出。非 secret 配置拥有代码内安全默认，生产差异由部署 manifest 注入。前端运行配置仅包含 API 相对路径，不包含 secret。

结构化 JSON 日志字段固定为 timestamp、level、service、version、requestId、route、method、statusCode、durationMs、errorCode、taskId（适用时）和 operationKind；logger redaction 覆盖 authorization、cookie、数据库 URL、请求/响应 body 和任意 secret 环境值。任务标题与说明即使在异常中也不得记录。

应用暴露内部 Prometheus 文本指标端点仅在平台能限制运维访问时启用；否则保持关闭，避免本次擅自增加公开运维接口。必需的可观测证据来自 stdout 日志与三个健康端点。指标若启用，只含请求计数、按路由模板/状态码的耗时、连接池状态和诊断结果，不含 task ID 或任务内容。未批准外部 telemetry backend，故设计不绑定或部署任何日志、指标、trace 产品。

业务诊断使用数据库 advisory lock 防止并发探针，并通过与普通任务相同的 application service、Repository、事务和提交后重新读取路径执行，只由内部 probe context 设置 `is_probe=true`。探针依次提交创建、完整读取、状态变更、重新读取、删除、最终不存在检查，并在 `finally` 清理遗留 probe；任一步失败、超时或清理不完整均为 `unavailable`。响应的 `affectedCapabilities` 只允许 `accept_request/read/create/change_status/delete` 枚举。

## SLO、限制、扩缩容、重试与恢复

用户可见 SLO 仅采用 `NFR-004`：0 和 500 个任务下加载各自 p95 ≤ 2 秒；500 个任务下创建、删除及六种状态转换各组 p95 ≤ 1 秒。每组严格使用 100 个独立样本和第 95 个升序值。设计不增加可用率、RTO、RPO 或团队规模承诺。

应用无进程内业务状态，可运行一个或多个副本；PostgreSQL 是状态所有者。平台可按 HTTP 负载扩缩，但数据库连接总数必须满足“副本数 × 每实例池上限 + migration/诊断余量”不超过环境连接预算。没有获批的负载阈值或副本上下限，因此这些值由部署环境容量声明，且必须在性能验收前固定并记录。

客户端读取失败允许用户触发重新获取。写操作只在确认未生效后以同一幂等键人工重试，不实施自动写重试；服务端对 serialization/deadlock 最多在同一请求内重试 2 次并使用 50 ms、100 ms 有界退避，超过后回滚并返回确定性 `503 TRANSIENT_FAILURE`。只有客户端无法获得该响应时才进入结果未知协调。数据库连接建立使用 driver 有界等待；不得以无限重试延迟明确反馈。

数据库事务保证单次操作原子性；服务重启前已提交结果保留，未提交事务回滚。PostgreSQL 备份、跨区恢复和灾难恢复目标未获批准，不作为本 Feature 承诺。业务诊断失败时 readiness/业务状态按各自语义报告，平台不得把仅有 liveness 成功解释为业务可用。

## 部署拓扑、迁移、Rollout 与 Rollback

构建采用 multi-stage Dockerfile：固定 Node 24 LTS patch 的 build stage 执行 `npm ci`、静态分析、测试外的生产构建；runtime stage 仅包含生产依赖、编译后 server、前端静态资源和非 root 用户。image 以 Candidate SHA 标记并由 digest 固定，下游部署、QA target 与证据必须引用同一 digest。

拓扑为 HTTPS ingress → 一个无状态 Fastify 应用部署 → PostgreSQL 17。数据库不对浏览器或公网开放。平台在应用接流量前，以同一 image 执行一次 `npm run db:migrate`；migration 身份与运行身份分离。应用仅在 migration checksum 与预期版本一致、数据库可查询后 readiness 成功。

首个 migration 创建状态类型、`tasks`、`idempotent_operations`、约束及普通任务读取索引。后续 migration 遵循 expand/contract：先部署向后兼容 schema，再部署应用，确认稳定后方可在后续 Candidate 移除旧结构。本次空仓库无历史数据导入或转换。

Rollout 先在新 Candidate 上运行 migration 和 readiness，再逐步接流量；失败即停止并恢复上一不可变 image。只要 migration 保持向后兼容，应用 rollback 不回滚数据库。若未来 migration 具有不可逆数据变换，必须在实施前提供独立备份/恢复方案；本次首建 migration 不需要数据 rollback。回退后重新执行业务诊断和关键功能验证，不能仅依赖容器启动。

active Feature 的 `runtime/deployment.json` 必须声明幂等 `developerSetupCommands`，以及唯一分类对象 `developerValidationCommands`：`staticAnalysis`、`build`、`developerTests` 三类均为非空命令数组；若实现声明 integration/functional 类，则分别放入 `integrationTests`、`functionalTests`。准备步骤包括锁定版本的 `npm ci` 与本地 PostgreSQL 启动/迁移，验证命令使用仓库既有 npm scripts，不依赖预热 cache 或检查失败后的临时安装。

## 验证环境责任矩阵（Verification Environment）

| 验证类型 | 责任阶段 | 环境来源 | 依赖/凭据 | Coding 证据 | 下游结果 |
|---|---|---|---|---|---|
| 类型、lint、构建、schema 与 unit | Coding | clean runner + Node 24 LTS | `npm ci`，无云凭据 | 命令、退出码、需求映射 | 平台 CI 对 Candidate 重跑后的通过记录 |
| PostgreSQL repository、migration、事务、幂等与 contract | Coding / 平台 CI | Docker Compose / CI 临时 PostgreSQL 17 | 短期本地数据库凭据 | 真实 PostgreSQL 执行结果、OpenAPI diff、`FR-002`—`FR-009` 映射 | clean runner 上同版本数据库的 integration 结果 |
| 浏览器主要流程与输入安全 | Coding / 平台 CI | Playwright 浏览器 + 本地同源应用 + PostgreSQL 17 | 无云凭据 | `IQA-001`—`IQA-005`、读取恢复、特殊文本、五类标题和六向转换自动化记录 | 当前 Candidate 的 functional 结果 |
| 结果未知六分支 | Coding / 平台 CI，最终由 Independent QA | Playwright 网络中断 + 真实 server/database；远程环境使用平台故障注入 | Coding 无云凭据；QA 使用批准环境权限 | 三类操作已生效/未生效分支、operation 查询与安全重试证据 | 精确部署 Candidate 上的真实中断与恢复结论 |
| 刷新与受控服务重启持久性 | Independent QA | 远程 integration 的同一 image 与真实持久 PostgreSQL | 受控重启权限、环境数据库身份 | 自动化脚本、8 组需求映射与本地辅助结果，不声称完成远程验收 | `IQA-006` 的刷新、重启事件及逐项集合对照 |
| 运行状态与部分失效 | Independent QA | 远程 integration + 批准的故障注入 | 部署、数据库故障控制权限 | 诊断 contract test 与本地故障辅助结果 | `IQA-009` 六种条件、内容保护和整体判定 |
| 320—1440 像素、200% 放大与 WCAG 2.2 AA | Coding 辅助；Independent QA 最终负责 | Playwright 视口矩阵；远程真实 Candidate | 浏览器与 axe-core，无业务 secret | 自动 viewport、键盘、axe-core 结果及场景映射 | `IQA-008` 与 `IQA-010` 的人工加自动完整验收 |
| 10 组性能样本 | Independent QA | 固定配置远程 integration、真实 PostgreSQL、精确 Candidate | 数据准备和性能执行权限 | 可执行采样工具、分组格式与本地校准结果 | 每组 100 样本、排序表、第 95 值和阈值结论 |
| 自动化覆盖审查 | Independent QA | 当前 Candidate 的 CI 与远程证据集合 | 只读证据访问 | `NFR-008` 逐项映射、通过率与 Candidate 标识 | `IQA-011` 覆盖率/通过率及证据完整性结论 |
| 发布后最小验证 | release verification | 已批准生产候选环境 | 受控运维访问，不使用任务内容作日志证据 | health 与无破坏 smoke 脚本 | image digest、readiness、业务诊断及回退可用性记录 |

## 快速验证指南（Quickstart）

在安装 Docker 与 Node.js 24 LTS 的 clean runner 上，先校验实际 Node 24.x patch 与 lockfile/Dockerfile 一致，执行 `npm ci`。通过 `docker compose up -d postgres` 启动 PostgreSQL 17，等待数据库健康后执行 `npm run db:migrate`。随后运行 `npm run dev`，浏览器访问 `http://localhost:3000`；API、SPA 与健康端点必须同源。

最小人工验证从空数据库开始：观察加载及创建引导；创建带说明和不带说明的任务；确认空、纯空白与 121 grapheme 标题被拒绝，1 与 120 grapheme 被接受；依次覆盖六向状态转换；分别取消和确认删除。每次确认结果后刷新页面并核对快照。

结果未知验证通过 Playwright 在请求提交后、响应到达前切断浏览器连接，分别使创建、状态变更和删除在数据库中已提交或未提交。恢复连接后只能使用 operation 与任务重新读取确认，已生效分支不得重复写入，未生效分支才可使用原幂等键重试。

执行 `npm run validate` 运行静态分析、构建和开发者测试；执行独立 npm scripts 运行 PostgreSQL integration 与 Playwright functional。Coding 只记录本地辅助结果，不执行云资源、远程重启、managed identity、网络、RBAC 或最终性能/WCAG 结论。容器验证使用 `docker build` 生成 image，启动后检查 `/health/live`、`/health/ready` 和 `/health/business`，并确认业务诊断不向 `/api/v1/tasks` 暴露 probe。

## 支持 Runbook

当 `/health/live` 失败时，检查进程退出原因、只读文件系统权限和端口绑定；由平台重启同一 digest，不先修改运行中容器。当 liveness 成功但 readiness 失败时，检查 schema version、数据库 DNS/TLS/连接额度和运行身份权限；禁止绕过 migration 或提升为数据库管理员。

当 `/health/business` 为 `unavailable` 时，使用 correlation ID 查找已脱敏日志和 `affectedCapabilities`，依次确认请求接受、读取、创建、状态变更、删除及 probe 清理。不得查询或复制普通任务内容作为诊断步骤。遗留 probe 只可由内置诊断清理路径按 `is_probe=true` 处理，不得用无条件任务删除语句。

当用户报告结果未知时，保留页面中的操作 key，先查询 `/api/v1/operations/{key}`，再重新获取目标任务或全部集合。操作存在即按已生效处理；操作不存在且权威集合证明未生效时才使用原 key 重试。不得换新 key 重放创建。

当性能退化时，按路由模板检查耗时、连接池等待、PostgreSQL query plan 和当前普通任务数；不得记录请求 body 或任务文本。优化必须保持 API 与产品行为，并按 10 个独立样本组重新验证。

发布异常时停止继续 rollout，保持数据库不执行破坏性回退，并部署上一不可变 image；确认其 schema 兼容后执行 readiness、业务诊断与关键流程。任何 migration 校验失败都禁止接流量。secret 疑似泄露时停止使用并由平台轮换，检查日志 redaction 和 image/history，但不得在工单或日志复制 secret。

## 开放决策

无。
