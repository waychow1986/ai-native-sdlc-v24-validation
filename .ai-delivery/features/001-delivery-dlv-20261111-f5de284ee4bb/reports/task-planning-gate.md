# Task Planning 阶段门禁报告

## 门禁信息

- **阶段：** `task-planning`
- **检查轮次：** 1
- **当前制品：** `tasks-implementation.md`
- **直接前置制品：** `design.md`
- **结论：** `需要修复`

## 内部自检

已检查全部任务的阶段划分、依赖顺序、准确路径、测试先行关系和完成证据。任务清单整体具备明确编号、来源、依赖、路径和任务级证据，但有三处会阻塞 Coding 交接：集合冻结并发机制没有形成测试先行的实现任务闭环；Phase 9 的运行生命周期与静态资源行为没有先行自动化验证；OCI Candidate 只有构建证据，缺少设计要求的容器运行验证。

## 直接前置一致性检查

已逐项对照已批准 `design.md`，并仅使用 `spec.md` 核对继承的验收场景追踪。User Story、API、数据模型、幂等恢复、业务诊断、性能工具、需求映射及部署契约总体忠实派生。以下问题均为明确 Design 内容在当前任务清单中的覆盖或排序缺口，责任归属 `task-planning`；未发现符合严格上游例外条件的 Design 歧义、矛盾、不可实现、不安全或治理冲突。

## 阻塞项

### TASK-SELF-001 集合冻结锁缺少测试先行的实现闭环

- **严重性：** `high`
- **范围：** `self`
- **制品：** `tasks-implementation.md`
- **责任 Agent：** `task-planning`
- **路由：** `current_stage`
- **原因类型：** `coverage`
- **证据：** `design.md` 第 131 行要求所有普通任务 mutation 获取集合冻结 shared advisory lock，业务诊断以 exclusive lock 冻结普通集合；第 192 行又以该锁保证数据库快照与 HTTP 集合摘要可比。当前 T030、T038、T046 的创建、状态变更和删除实现均未要求 shared lock；唯一明确检查集合冻结的 T057 位于这些实现之后，违反清单第 7 行的测试先行规则，也无法在实现前约束三类 mutation。
- **修复建议：** 在三类 mutation 实现之前安排覆盖 shared/exclusive 集合锁、释放和并发行为的先行测试，并在 T030、T038、T046 或独立的准确路径任务中明确实现统一集合锁算法；调整依赖，使相关生产实现必须等待该测试落盘。

### TASK-SELF-002 运行生命周期与静态交付行为未按 test-first 规划

- **严重性：** `high`
- **范围：** `self`
- **制品：** `tasks-implementation.md`
- **责任 Agent：** `task-planning`
- **路由：** `current_stage`
- **原因类型：** `incomplete`
- **证据：** T065 直接实现 migration/server 启动入口、终止信号排空、静态资源缓存策略和 SPA fallback，但此前 T009—T064 没有任务以准确测试路径验证这些行为；T065 的完成证据仅为本地启动后端点同端口工作，不能验证排空、缓存策略或 fallback。该安排违反 `tasks-implementation.md` 第 7 行“测试任务必须位于对应生产实现任务之前”，也不足以证明 `design.md` 第 37、133、208—214 行的生命周期与交付约束。
- **修复建议：** 在 T065 前增加具有准确路径和可执行证据的先行测试任务，分别覆盖 migration 启动约束、终止排空、入口 HTML/哈希静态资源缓存和 SPA fallback，并让 T065 显式依赖这些测试。

### TASK-SELF-003 OCI Candidate 缺少可执行的容器运行验证任务

- **严重性：** `high`
- **范围：** `self`
- **制品：** `tasks-implementation.md`
- **责任 Agent：** `task-planning`
- **路由：** `current_stage`
- **原因类型：** `coverage`
- **证据：** `design.md` 第 241 行要求容器验证构建 image、启动容器、检查 `/health/live`、`/health/ready`、`/health/business`，并确认业务诊断 probe 不暴露到 `/api/v1/tasks`。T066 的证据只有 `docker build` 与 image history/环境 secret 检查；T067 只验证 `runtime/deployment.json` 的 schema 和分类命令。清单没有提供容器启动、数据库/migration 前置、健康检查及 probe 隔离验证的准确执行路径、依赖和完成证据。
- **修复建议：** 在 T066 之后、T067 完成前增加准确路径的 Candidate 容器验证任务，声明数据库与 migration 前置、容器启动和清理、三个健康端点及普通任务集合 probe 隔离断言，并以真实命令输出和退出码作为完成证据。

## 通过条件

修复上述三项后重新执行 `task-planning` 门禁：集合冻结机制形成测试先行且覆盖三类 mutation 的任务闭环；T065 的全部运行行为具有先行自动化验证；构建出的 OCI Candidate 具有可执行的容器运行与健康/probe 隔离验证。重新检查不得引入 Design 清单外路径或把下游远程验收结果作为 Coding 前置条件。
