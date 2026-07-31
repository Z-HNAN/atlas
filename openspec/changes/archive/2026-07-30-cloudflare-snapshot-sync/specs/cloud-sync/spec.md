# cloud-sync 增量规范

## MODIFIED Requirements

### Requirement: Cloudflare 通用快照服务

云同步 SHALL 使用 Cloudflare Access、Worker、D1 元数据和私有 R2 不可变快照；前端 SHALL 只调用 Worker API。

#### Scenario: 提交与竞争

- **WHEN** 成员上传合法快照、baseVersion 和 commitId
- **THEN** Worker 先写 R2，再用 D1 条件插入提交；版本过期返回 409 且不静默覆盖

#### Scenario: Payload Schema 不匹配

- **WHEN** 上传版本与 App 当前 payloadSchemaVersion 不一致
- **THEN** Worker 在写入对象前拒绝提交，客户端保留本地 dirty

#### Scenario: 上传期间继续编辑

- **WHEN** 客户端等待上传响应时产生新的本地 dataVersion
- **THEN** 上传响应不得把新修改标为已同步，新修改继续保持 dirty 和 pending

### Requirement: 云版本与 Payload 版本分离

`version` SHALL 是 app/user 单调递增的云提交序号；`payloadSchemaVersion` SHALL 只描述 TripPayload，二者不得与本地 dataVersion 混用。

#### Scenario: 本地修改尚未上传

- **WHEN** 本地 dataVersion 增长但没有创建新的云提交
- **THEN** lastCloudVersion 保持不变，下一次提交继续使用当前云 version 作为 baseVersion

### Requirement: Access 与成员授权

Worker SHALL 验证 Access JWT 和预配置成员关系；非成员不得读取，readonly 不得提交。

#### Scenario: 非成员访问

- **WHEN** 有效 Access 用户不是目标 App 的预配置成员
- **THEN** Worker 拒绝读取和写入，且不得返回快照元数据

### Requirement: 私有对象与保留

R2 SHALL 保持私有，对象键由服务端生成且不含 PII。默认保留最近 50 个版本，并清理 24 小时以前的孤儿对象。

#### Scenario: 清理超限历史

- **WHEN** 定时任务发现超过保留数量的非最新版本
- **THEN** Worker 先删除 R2 对象，再软删除 D1 元数据；R2 失败时保留元数据供重试
