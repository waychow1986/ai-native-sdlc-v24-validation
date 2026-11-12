# Independent QA 计划

## Candidate 与执行边界

- Delivery ID：`DLV-20261111-B5E3DF2255F5`
- Candidate SHA：`10d25e88efd46558fe6e0dc9b51c063f7373e9b0`
- 部署 image：`acraidhdevivmw2d.azurecr.io/ai-native-sdlc-v24-validation@sha256:f589076d091e3e057f8c8415446ca7a9052e3164c466054bd36201be36036276`
- QA URL：`http://20.22.126.72`
- Readiness path：`/health/ready`
- 本次为首次 Independent QA，`bugfixResults` 必须为空数组。
- 平台在 QA Runner 中注入 `QA_DELIVERY_ID`、`QA_CANDIDATE_SHA`、`QA_BASE_URL`、`QA_HEALTH_PATH`、`QA_PLAN_COMMIT_SHA`、`QA_PLAN_HASH` 和 `QA_RESULT_PATH`。脚本不得硬编码上述 Candidate 身份或 URL。
- 先在最多五分钟内确认 DNS、适用时的 TLS、readiness 和 `/candidate-identity`；身份必须与平台输入完全一致。环境未就绪时停止功能检查，并按环境失败语义写结果。
- 所有功能检查由平台 QA Runner 针对部署 URL 执行。Copilot Cloud sandbox 不访问该 URL。

## 执行任务

- [ ] **IQA-001 首页正常加载**
  - **追溯：** INT-001、INT-003、INT-005、INT-008、INT-012、INT-014；US-001；FR-001～FR-002；NFR-005～NFR-006；AC-001～AC-002。
  - **输入或命令：** Chromium 打开 `QA_BASE_URL`；在浏览器网络层暂挂首次 `GET /api/status`，检查页面后再放行请求。
  - **预期结果：** 页面主体在打开操作后 2 秒内显示标题“最小流程验证”和唯一状态区域；未决期间仅显示“正在获取状态”，不显示成功或失败；只发起一次同源 `GET /api/status`。
  - **证据要求：** Candidate identity、打开与页面完成原始时间、标题/状态区域数量及文本、请求 method/URL/次数、未决状态观察结果。

- [ ] **IQA-002 首次状态获取成功**
  - **追溯：** INT-001、INT-006、INT-008、INT-012；US-002；FR-002～FR-003；AC-003。
  - **输入或命令：** 新浏览器上下文打开 `QA_BASE_URL`，记录首次 `GET /api/status` 的触发和页面成功状态时间。
  - **预期结果：** 一次只读请求在 3 秒内完成；唯一状态区域从处理中转为且仅显示区分大小写的“ok”；无重试按钮，成功后不自动刷新。
  - **证据要求：** 请求 method/URL/次数、原始计时、最终状态区域文本与数量、无重试和无后续自动请求观察。

- [ ] **IQA-003 首次状态获取失败**
  - **追溯：** INT-001、INT-004、INT-007～INT-008、INT-012～INT-013；US-003；FR-002、FR-004；NFR-003；AC-002、AC-004。
  - **输入或命令：** 新浏览器上下文仅对页面真实发出的首次 `GET /api/status` 执行网络 abort，不伪造响应。
  - **预期结果：** 3 秒内保留标题和唯一状态区域，显示“状态获取失败，请重试”及唯一“重试”按钮；不显示“ok”或内部错误；失败后不自动请求。
  - **证据要求：** 被 abort 的真实请求、失败耗时、失败文本和操作数量、无成功/内部错误/自动重试观察。

- [ ] **IQA-004 失败后人工重试成功**
  - **追溯：** INT-001、INT-007～INT-008、INT-012、INT-015；US-003；FR-002、FR-005～FR-006；AC-005～AC-006。
  - **输入或命令：** 首次 `GET /api/status` 网络 abort 后解除阻断；点击唯一“重试”按钮并记录新请求及状态变化。
  - **预期结果：** 用户操作只触发一次新的 `GET /api/status`；页面先显示处理中，并在请求触发后 3 秒内以“ok”替换失败结果，无需重新打开页面。
  - **证据要求：** 失败、点击、第二次请求、处理中和成功的连续记录，重试耗时及精确请求计数。

- [ ] **IQA-005 连续失败后再次恢复**
  - **追溯：** INT-002、INT-007～INT-012、INT-015；US-003；FR-002、FR-005～FR-007；AC-005～AC-008。
  - **输入或命令：** 对首次请求和第一次人工重试执行网络 abort，第二次人工重试解除阻断并请求真实服务。
  - **预期结果：** 每次点击各触发一次新请求；连续失败后仍只有一个失败提示和一个重试按钮且不自动请求；第二次重试在 3 秒内显示“ok”；无历史、导航或附加功能。
  - **证据要求：** 三次请求与两次用户操作的顺序、次数和耗时，连续状态转换、无自动请求及最终成功记录。

- [ ] **IQA-006 最小权限与隐私边界**
  - **追溯：** INT-003～INT-004、INT-009、INT-012～INT-014；US-001～US-003；FR-007；NFR-003；AC-009。
  - **输入或命令：** 汇总成功、失败和恢复旅程，并检查页面全部可见文本、链接、表单控件和可操作元素。
  - **预期结果：** 不要求登录、身份、个人信息或凭据；不提供写入、差异化权限、导航或范围外业务操作；页面不展示 secret、客户内容或技术错误。
  - **证据要求：** 三类旅程结果、页面内容和操作清单、链接/输入/表单/按钮计数及敏感或内部内容缺失观察。

- [ ] **IQA-007 键盘、辅助技术与 WCAG 2.2 AA**
  - **追溯：** INT-003、INT-005、INT-007、INT-013；US-001～US-003；NFR-004；AC-010。
  - **输入或命令：** 在 320 与 1440 CSS 像素、200% zoom 下运行 axe-core；检查 accessibility tree、live/alert 语义、非纯颜色文本和布局溢出；仅用 `Tab`、`Enter` 完成失败后重试并检查焦点可见性。
  - **预期结果：** 适用的 WCAG 2.2 AA 检查无失败；标题、状态和操作在各视口/缩放下可见且无二维溢出；处理、成功和失败可被辅助技术感知；键盘可完成重试且焦点可见。
  - **证据要求：** axe 结果、视口/zoom/overflow 数值、accessibility tree、键盘步骤、焦点及 computed style。若 QA Runner 无法取得规格要求的人工辅助技术观察，不得以自动化替代，必须将具体缺口写入 `testGaps` 并判定本场景失败。

- [ ] **IQA-008 外部质量边界**
  - **追溯：** INT-001、INT-008、INT-012～INT-013；US-001～US-003；FR-002；NFR-001～NFR-002；AC-011～AC-012。
  - **输入或命令：** 汇总 IQA-001～IQA-005 同一 Candidate 的页面、请求与状态原始时间；分别核验成功、失败、恢复三类执行。
  - **预期结果：** 页面主体不超过 2 秒；首次和每次重试从请求触发到成功或失败均不超过 3 秒；成功、失败、恢复 3/3 按契约通过，不以 health、伪造成功或范围扩展替代。
  - **证据要求：** 同一 Candidate 身份、各计时起止点与耗时、三类场景逐项结果及 3/3 汇总结论。

## 结果判定与证据规则

- `scenarios` 按 IQA-001～IQA-008 各返回一项，包含 boolean 结果、实际外部服务（本 Feature 无外部业务服务，均为空数组）和具体证据。
- 仅当八个场景全部通过且 `defects`、`testGaps` 均为空时，顶层 `passed` 才为 `true`。
- 产品行为不符合批准契约时写入 `defects`；批准覆盖无法执行或所需测试 interface 不可用时写入 `testGaps`。
- DNS、TLS、Runner、readiness 或 Candidate identity 失败属于环境失败：`passed: false`，`defects` 与 `testGaps` 均为空，并在 `evidence` 中记录诊断。
- 结果必须原样包含 `QA_CANDIDATE_SHA`、`QA_BASE_URL`、`QA_PLAN_COMMIT_SHA`、`QA_PLAN_HASH`，并仅向 `QA_RESULT_PATH` 写入一个有效 JSON。发现产品缺陷时脚本仍以零状态退出。

## 计划自检

- **完整性：通过。** IQA-001～IQA-008 全部具有独立任务，覆盖页面加载、成功、真实网络失败、人工恢复、连续失败、范围/隐私、WCAG 与性能/可靠性边界。
- **追溯性：通过。** 每项任务直接引用 approved Intent、User Story、FR/NFR 和 AC；预期结果仅来自 approved `spec.md`，代码仅用于确认可用风险注入方式。
- **边界/负向/安全/兼容性：通过。** 已包含未决边界、连续失败、无自动请求、敏感信息缺失、键盘/辅助技术、320/1440 viewport、200% zoom 和同一不可变 Candidate 身份。
- **范围控制：通过。** 未增加登录、数据库、外部 integration、telemetry、告警或其他未批准门禁；health 与 identity 仅作为前置条件，不替代功能验收。
- **执行就绪：通过。** 任务明确了输入、命令、预期和证据；可据此生成 `runtime/qa-run.sh`。完整 WCAG 2.2 AA 所要求的人工辅助技术观察不能被自动化伪造，若 Runner 未提供该证据，脚本将如实报告测试缺口。
