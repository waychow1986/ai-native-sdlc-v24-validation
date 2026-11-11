# Task Planning 阶段门禁报告

## 门禁信息

- **阶段：** `task-planning`
- **检查轮次：** 1
- **当前制品：** `tasks-implementation.md`
- **直接前置制品：** `design.md`
- **结论：** `需要修复`

## 内部自检

已检查全部任务的阶段划分、依赖顺序、准确路径、执行前置条件、test-first 顺序和完成证据。Setup、Foundational 与三个 User Story 的主要实现路径具备明确依赖，实际改动路径均受 Design 根路径清单支持；但强制验证聚合与任务自身声明不一致，且一项样式实现把新增验收测试与生产改动合并，尚未满足可执行的 test-first 交接条件。

## 直接前置一致性检查

已逐项核对 approved `design.md` 的技术决策、Component 边界、状态与接口契约、安全边界、验证环境责任矩阵及 Quickstart，并以 `spec.md` 的 IQA 场景仅作验收追踪核验。Tasks 覆盖主要应用、容器和部署声明，但没有把 Design 要求的全部 Candidate 级验收脚本输入落实为可执行任务。Design 本身不存在需要返回 Technical Solution 的严格上游例外；发现的问题均归属当前 Task Planning。

## 阻塞项

### TASK-SELF-001 强制 `npm test` 聚合遗漏 functional 测试套件

- **严重性：** `high`
- **范围：** `self`
- **制品：** `tasks-implementation.md`
- **责任 Agent：** `task-planning`
- **路由：** `current_stage`
- **原因类型：** `contradiction`
- **证据：** T001 明确规定 `test` 串行聚合 component、contract、integration 与本地浏览器测试，却未包含后续 T012、T021、T028、T032 创建或修改的 `tests/functional/` 套件；“完成证据”又要求保留 functional 结果，并仅以 `npm test` 作为 Coding 总体验证入口。按当前任务执行无法确定 mandatory functional tests 会进入唯一开发者测试门禁。
- **修复建议：** 在 T001 的 `npm test` 聚合范围中明确纳入 `tests/functional/`，并使任务级与总体验证证据使用同一套强制执行边界。

### TASK-SELF-002 T032 未保持 test-first 任务顺序

- **严重性：** `high`
- **范围：** `self`
- **制品：** `tasks-implementation.md`
- **责任 Agent：** `task-planning`
- **路由：** `current_stage`
- **原因类型：** `contradiction`
- **证据：** 任务规则要求测试任务位于对应生产实现任务之前；T032 却在同一任务中同时修改 `src/client/styles.css` 与两个 functional 测试文件，并首次要求 viewport、200% zoom 等自动化结果，因此这些新增验收断言没有独立的前置测试任务。
- **修复建议：** 将 T032 拆为先新增或收紧 viewport、zoom、焦点和非颜色断言的测试任务，再执行样式收口的生产实现任务，并更新后续依赖。

### TASK-SELF-003 Candidate 级 IQA-006 与 IQA-007 自动化输入未落实到 Playwright 任务

- **严重性：** `high`
- **范围：** `self`
- **制品：** `tasks-implementation.md`
- **责任 Agent：** `task-planning`
- **路由：** `current_stage`
- **原因类型：** `coverage`
- **证据：** Design 验证环境责任矩阵要求为 IQA-001～IQA-006、IQA-008 提供自动化脚本和证据采集能力，并要求 IQA-007 具备 axe、键盘与焦点测试输入。现有 Playwright 任务 T013、T022、T029 仅明确覆盖 IQA-001～IQA-005、IQA-008；IQA-006 的完整最小权限/隐私旅程及 IQA-007 的 axe、键盘和焦点仅出现在非浏览器 Candidate 级的 functional 任务中。完成证据声称 Playwright 支持 axe-core 和键盘/焦点证据，与具体任务不一致。
- **修复建议：** 增加位于相应实现之前的 Playwright 任务，明确覆盖 IQA-006 的完整旅程边界及 IQA-007 的 axe、键盘与焦点自动化输入，并建立与现有 E2E 文件修改顺序一致的依赖。

## 通过条件

修复全部三个阻塞项：确保 `npm test` 强制执行 functional 套件；将 T032 调整为明确的测试先行顺序；为 IQA-006 与 IQA-007 补齐 Candidate 级 Playwright 任务及依赖。修复后重新执行 Task Planning 内部自检和与 approved `design.md` 的直接前置一致性检查，且 findings 为空。
