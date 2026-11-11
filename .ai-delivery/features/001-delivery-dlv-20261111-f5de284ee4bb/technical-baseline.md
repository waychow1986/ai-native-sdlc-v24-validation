# 项目技术基线

**版本：** 1
**批准基线记录 SHA-256：** `f22dab50553d6d81f182856c707de30689cdafa06bdd944c68c0c5c6bd34eb20`
**选择模式：** `agent_proposed`

## 技术要求



## 标准与约束

必须保持已批准业务范围并选择满足可衡量需求的最简单架构；凭据仅保留在服务端，支持时使用 managed identity，并实施输入校验、least privilege，禁止记录 secret 或客户任务内容；每项用户可见能力必须具有可独立执行的验收场景，外部 integration 必须使用真实测试服务执行 contract、integration 和 end-to-end 测试，Mock 不得替代 functional acceptance；Coding 沙箱不得访问或验证 Azure/云资源、远程部署环境、托管身份、网络或 RBAC，相关验证仅由 Independent QA 针对已部署的精确 Candidate 执行；性能、可靠性、安全及全部交付门禁必须可衡量且可追踪。

## 已批准的 Agent 建议

- 推荐基线（Option A）：采用 Node.js 24 LTS（固定最新受支持的 24.x patch）与 TypeScript 5.9；前端使用 React 19 + Vite 7，服务端使用 Fastify 5，数据访问使用 node-postgres 与显式 SQL migration，持久化使用 PostgreSQL 17。构建单一 OCI image，由 Fastify 同源提供静态前端与版本化 REST/JSON API，避免 CORS、分布式事务和不必要的服务拆分；写操作使用数据库事务、客户端生成的 idempotency key 与操作结果重新读取来支持“结果未知”恢复，标题长度按 Unicode grapheme cluster 校验，所有任务文本按纯文本编码呈现。云端首选 Azure Container Apps（单一应用、可按负载扩展）与 Azure Database for PostgreSQL Flexible Server；应用以 managed identity 获取 Key Vault 中的数据库凭据或在平台支持时使用无密码数据库身份，数据库账号仅授予应用 schema 所需权限。使用 HTTPS、参数化查询、严格 Content-Security-Policy、安全响应头、请求体大小限制、结构化但不含任务内容的日志；不增加产品登录或角色能力。测试环境采用本地 Docker Compose PostgreSQL、平台 CI 的临时 PostgreSQL 与 Playwright 浏览器，远程 integration/Independent QA 使用同一不可变 image、真实 managed PostgreSQL、受控服务重启、故障注入、320—1440 逻辑像素与 200% 放大、axe-core 加人工 WCAG 2.2 AA 验证，以及按规格分组的性能采样。运行约束为 migration 在应用接流量前单次执行、readiness 仅在依赖可用后成功、独立受保护的业务诊断流程验证读取及创建/变更/删除并清理专用探针数据、滚动发布失败时回退上一不可变 image；不承诺规格未批准的可用率、灾备时限或并发语义。该方案最符合当前空仓库、小型团队、500 项任务上限和最简单架构原则，是建议批准的 baseline。
- 备选基线（Option B）：采用 .NET 10 LTS、ASP.NET Core 10 Minimal API、Entity Framework Core 10、React 19 + Vite 7 与 PostgreSQL 17，同样部署到 Azure Container Apps + Azure Database for PostgreSQL Flexible Server，并沿用 Option A 的单体容器、REST/JSON、managed identity、Key Vault、数据库最小权限、真实环境测试和不可变发布约束。优势是 runtime 与 framework 具有统一 LTS 生命周期、强类型 API/数据模型、内建健康检查和成熟的 migration/tooling；代价是前后端仍需两套构建工具链，初始 image 和内存通常高于 Node.js 方案，对当前小型 CRUD 范围没有足以抵消复杂度的明确客户约束，因此不作为首选。
- 备选基线（Option C）：采用 Node.js 24 LTS、TypeScript 5.9、React 19 + Vite 7、Fastify 5 与 SQLite 3（WAL 模式），以单副本 OCI container 配挂受管理的持久卷；可在 Azure Container Apps 使用 Azure Files，也可部署到提供等价持久卷和滚动回退能力的受管理容器平台。优势是组件最少、成本和本地启动复杂度最低，足以处理规格中的 0—500 项任务；代价是必须固定单写入副本，持久卷故障语义、备份恢复、部署切换和 SQLite 文件锁需要额外验证，横向扩展会迫使迁移数据库，且 Azure Files 上的 SQLite 锁与延迟必须在真实 integration 环境证明满足性能和持久性门禁。仅当技术负责人明确接受单副本运维边界且真实环境验证通过时选择，否则采用 Option A。
- 云平台替代：若组织已有 AWS 或 Google Cloud 标准，可保持 Option A 的 Node.js/React/Fastify/PostgreSQL、同源 REST/JSON、事务与幂等恢复、安全及测试边界不变，分别映射到 AWS App Runner + Amazon RDS for PostgreSQL + Secrets Manager/IAM role，或 Google Cloud Run + Cloud SQL for PostgreSQL + Secret Manager/service account。优势是复用既有 landing zone、身份、网络和运维能力；代价是需要平台特定的无密码连接、连接池、迁移执行、故障注入和受控重启 contract test。当前仓库没有批准的云 provider、landing zone 或资源标识，因此这些映射仅是可选候选，不能作为客户 requirement 或 mandatory standard。