# Property Management Process Reward — 10 历史参考样本

这是开发用 Process Eval 集。每个样本评估 **一个历史决策点的下一次实际业务工具动作**，不是整单结果。10 个样本来自 8 个物业案例。不是举办方官方 golden set，也不是对历史动作逐字匹配的测试。

数据源：`DwellyOrg/HackatonPublicCases`，固定 commit `9bcdca585955dfb930005ed742572606e68f5688`。MCP 基于已合并的单步接口 commit `1ff6e85`，支持 `run_case({case_id, step})`。

## 样本列表及 derive 来源

| ID | Case / step | 可见证据 | 历史参考动作 | 映射到当前 MCP 的业务工具 |
|---|---|---|---|---|
| pm-011-initial-approval | 011 / 3 | 001–003 故障及先审批要求 | 004 向房东申请工程师检查 | request_landlord_approval；允许等价 send_message |
| pm-011-approved-assignment | 011 / 10 | 004 请求、009–010 批准 | 011 分配维修人员 | assign_contractor |
| pm-017-switch-troubleshooting | 017 / 8 | 001 故障、008 开关位置 | 009 转达指引并请求反馈 | send_message → tenant |
| pm-017-await-tenant | 017 / 9 | 008–009 已发排查指引 | 010 记录等待租客回复 | hold → Waiting for Tenant |
| pm-013-report-completion | 013 / 27 | 027 匹配地址的完工发票消息 | 028 通知房东完工 | send_message → landlord |
| pm-028-landlord-own-repair | 028 / 7 | 003 提供选项、007 房东自处理 | 008 等待房东安排方完成 | hold → Waiting for Landlord |
| pm-032-conditional-assignment | 032 / 8 | 006–008 批准及大工程先报价 | 009 分配维修人员 | assign_contractor，保留授权限制 |
| pm-035-landlord-resolved-close | 035 / 12 | 006 自处理、011–012 完成确认 | 013 完成，无物业付款 | close_case → work_completed |
| pm-044-clarify-window | 044 / 4 | 001 未说明故障窗户位置 | 005 询问哪个窗户 | send_message → tenant |
| pm-049-conditional-self-fix | 049 / 7 | 001、004、007 条件性批准 | 008 转达自修／承包商选项 | send_message → tenant |

`step` 是 **包含式 event 编号**，不是工具调用次数。比如 step=8 的输入包含 event 001–008，参考动作 event 009 只供评分使用。

每个 `samples/*.json` 包含：

- `input`：隔离 fixture 路径、MCP 调用参数及可见事件。
- `expected`：允许工具、严格参数、语义评分项及禁止行为。
- `provenance.input_evidence`：截断点之前的证据原文。
- `provenance.reference_actions`：未来的参考动作原文，仅供评审。
- `provenance.derivation`：从历史动作映射到当前工具的推导，明确原文直接支持与字段推断。
- 数据 commit、原文件 SHA-256、事件编号、原文行号及固定版本 GitHub 链接。

## 输入隔离

`fixtures/<eval-id>/<case-id>/` 是专门裁剪的输入副本：只保留 Case details（删掉 Status/Updated/Completed）、Initial request 和到 step 为止的历史。Overview、Outcome、Next action 等参考答案不放进输入。

这些样本无需附件内容。所有附件文件及清单都没有复制，以避免将未来收到的发票或图片提前暴露。历史中原本引用的不可用附件仍保持不可用；不能捏造其内容。

**只把 fixture 路径交给 agent，绝不能把 samples JSON 或完整原案例目录交给 agent。** 标签含未来原文。评分器可以读标签，被评 agent 不能读标签。

每个样本独立运行，使用 `run_case` 重置状态。不能在同一 case 的不同截断点之间使用 `resume_case`：它会带入先前生成的动作，并且会过滤部分历史物业事件，与本集的完整截断前缀不同。

## 本地 MCP 运行方式

从仓库根目录启动一个样本的 stdio MCP：

```sh
CASES_DIR='evals/Process Reward/fixtures/pm-028-landlord-own-repair' \
OUT_DIR='runs/process-eval/pm-028-landlord-own-repair' \
npm run --silent mcp
```

通过连接的 MCP client 调用：

```json
{"name":"run_case","arguments":{"case_id":"028","step":7}}
```

每个样本使用 manifest 中自己的 `cases_dir`，并使用独立 OUT_DIR。执行仍需配置 ANTHROPIC_API_KEY 和模型；本数据集生成、校验不需要 API key，也不会调用真实模型。

## Process Reward 评分

真实模型运行（从仓库根目录；读取本地 `.env`）：

```sh
node --env-file=.env --import tsx 'evals/Process Reward/run.ts'
```

默认使用仓库的 `claude-sonnet-5-5`，可用 `MODEL` 环境变量覆盖。结果及原始 trace 写入被 Git 忽略的 `runs/process-eval/`。runner 自动检查工具及严格参数；语义评分仍需要复核。API 失败记为 `runtime_failure`，分数为 null，不能当作模型判断错误。

读取实际 `state/<case>.json` 的 `actions` 或 `traces/<case>.jsonl` 的 `tool` 条目，不能仅依据模型说自己做了什么。

1. 检查一个实际业务工具尝试、执行成功，以及 `tool` / `exact_arguments` 是否匹配一个允许分支。无动作、多个动作、工具失败、分支不匹配均为 0 分，同时保留失败证据。
2. 对该允许分支的 `semantic_requirements` 逐项判断；每项通过记其 weight，未通过记 0。得分 = `4 × 通过权重 / 总权重`，保留两位小数。
3. 命中禁止行为则 0 分。禁止行为也要检查实际参数及消息，不能仅查工具名称。
4. 合理替代路径但不在标签中：记录 `needs_review`，经复核再修改 rubric，保留原始输出。不能以历史为唯一真理。

工具名和枚举可以自动验证；消息/notes/reason 的含义需要语义评审。这一版提供测试数据与 rubric，尚未实现自动语义 judge。

**不要要求只能在未来参考动作中看到的事实。** 013/27 不要求输出 £162.85，该数字首次出现在隐藏的 028。035/12 的房东亲自修理及完成确认是直接历史证据；keys=not_issued / invoice=not_required 是 MCP 参数映射推断，不是独立 golden 字段，也不计独立分数。无物业付款不等于有已付款发票。

## 校验

从仓库根目录执行：

```sh
node --import tsx 'evals/Process Reward/validate.ts'
```

如果原案例仓库也在旁边，可以核查 SHA、来源行号和原文：

```sh
node --import tsx 'evals/Process Reward/validate.ts' ../HackatonPublicCases
```

校验 10 个 fixture 的截断、标签引用、工具兼容性，并通过真实 MCP 协议入口使用假模型检查输入边界和输出文件生成。**它不是模型准确率测试，不能将 10 个校验通过写成 agent 10/10。**

这些案例已公开，现有 agent policy 也由同一批案例总结，属于开发集，不能证明对未见 Reality Test 的泛化表现。
