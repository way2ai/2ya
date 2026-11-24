# 贡献指南

此规范适用于全栈团队协作开发，目的在于项目健康的成长。

## 开发工程化

1. 一键启动脚本（根目录 package.json）：做到一个命令把 React 开发服务器、Python 虚拟环境服务、Electron 窗口全部拉起来。

```bash
npm run dev
```

2. 代码检测：目的是保证提到 Git 上的代码风格就像是一个人写的一样。
   通过 Git 提交拦截（Husky + lint-staged）：

- 检测到前端代码，自动跑 eslint + prettier；
- 检测到 Python 代码，自动跑 ruff 或 black（格式化神器）。

3. 版本号统一存放点：

- 不要让版本号在多处分散维护。通常以前端的 package.json 中的 "version": "0.1.0" 为主基准。
- Python 侧可以通过启动传参或者读取配置获取该版本号。

4. 依赖隔离与锁定：

- Node 侧：必须将 package-lock.json 或 pnpm-lock.yaml 提交到 Git，强制团队成员使用相同的包管理器版本。
- Python 侧：必须有依赖清单！如果团队成员乱装库会导致其他人跑不起来。
  - 极简方案：根目录提供 requirements.txt。新增依赖时必须提 PR 更新它。
  - 专业方案：使用 Poetry 或 Pipenv 锁定依赖版本。

5. .gitignore 文件一定要配全：
   不能把 node_modules、Python 的 **pycache**、.venv 虚拟环境、打包输出的 dist 提交到 Git。

## 短生命周期分支

栈开发改动的范围广（文件多），分支绝对不能在本地保留太久，否则 Merge 时能让你怀疑人生。

1. 废弃繁重的长周期分支：采用 GitHub Flow（更轻量）：没有复杂的 develop，只有 main。原则上一个 feat 生命周期不要超过 2 天。
2. 小步快跑（Small PRs）：哪怕功能没全部做完，只要协议加了、底层跑通了，就应该先提 PR 合并回主干。
3. 强制 Rebase：在合并前，必须执行 `git pull --rebase origin main`，在本地先把冲突解掉，保证 Git 提交图是一条清爽的直线。

## 架构治理

把“强依赖”改成“事件总线（Event Bus）”，重叠的根本原因，是两个功能在直接修改同一个对象。
例如：开发者 A（饥饿系统）和开发者 B（天气插件）都想让宠物做动作，如果都去直接改 pet.current_animation = 'xxx'，就会冲突。

**解法：引入事件驱动，谁也别直接碰核心逻辑**：在 Python 和 Electron 中引入发布-订阅（Pub/Sub）机制，大家通过“事件”间接通信，互不碰对方的代码文件。

- Python 侧：谁也不要去改对方的类。需要交互时，向全局发送一个 Event。
- Electron 侧：不要写一个巨大无比的 switch-case。采用动态路由注册：
- React 侧（插槽模式）：不要往 Pet.tsx 里狂堆代码。Pet.tsx 只留插槽（Slots），其余的通过 Context 或独立的小组件挂载。例如“洋葱式拆分”：把大文件拆成独立的 Layer（图层），全栈们各自领自己的图层文件夹开发，Git 自然就合流顺畅了。

**协议先行**：定义所有经过 Pipe 和 IPC 的消息格式标准：

```json
// shared/events.json
{
  "PET_ACTION": {
    "sender": "python",
    "receiver": "react",
    "payload": { "actionName": "string", "duration": "number" }
  },
  "UPDATE_CONFIG": {
    "sender": "react",
    "receiver": "python",
    "payload": { "petName": "string", "volume": "number" }
  }
}
```

铁律：如果一个全栈要加新功能，涉及跨进程调用，先在群里或 PR 里提协议变更，协议 Merge 后再写具体业务。这样两人同时开发也不会把通信管线改串。

## 开发有交集

假设A和B开发涉及有交集的文件或者数据结构：

1. 识别重叠：开发前，A 和 B 先沟通讨论清楚
2. 先完成重叠部分（PR#0）：A 和 B 新拉共同的 refactor/xxx 交集文件分支并 Review&Merge 到 main 分支
3. 各自开发（PR#1）：A 和 B 重新从最新的 main 分支切出各自的 feat/xxa 和 feat/xxb

## 版本推进示例

版本命名统一遵循 语义化版本 (Semantic Versioning) 标准。

## 版本推进与发布流程

### 1. 版本号规则

版本号使用 `MAJOR.MINOR.PATCH[-预发布标识]` 格式，例如 `0.2.0`、`0.2.0-beta.1`。

- `PATCH`：修复问题，不增加面向用户的新功能，例如 `0.1.0 → 0.1.1`。
- `MINOR`：增加一组可交付的功能，例如 `0.1.1 → 0.2.0`。
- `MAJOR`：项目进入正式稳定阶段后，存在不兼容变更时递增，例如 `1.2.0 → 2.0.0`。
- `0.x.x`：表示项目仍处于早期开发阶段，功能和接口可能调整，不承诺向下兼容。

预发布版本使用以下标识，序号从 1 开始递增：

- `alpha`：内部测试，功能可能不完整，主要用于团队验证。
- `beta`：功能基本齐全，开放给用户或社区试用并收集反馈。
- `rc`：发布候选版，功能冻结，只处理阻止发布的问题。
- 不带预发布标识：正式稳定版。

例如：`0.2.0-alpha.1 → 0.2.0-alpha.2 → 0.2.0-beta.1 → 0.2.0-rc.1 → 0.2.0`。

预发布阶段发现的问题应先修复并重新测试；如果发布目标没有变化，递增预发布序号。如果目标版本已发布，后续修复则递增 PATCH，例如 `0.2.0 → 0.2.1`。

### 2. 分支命名

分支名表达“这条分支正在做什么”，不代替版本号。默认从最新的 `main` 创建短生命周期分支，完成后通过 PR 合并回 `main`。

建议格式：

- `feat/<任务号>-<简短描述>`：新功能，例如 `feat/42-pet-heartbeat`
- `fix/<任务号>-<简短描述>`：一般缺陷修复，例如 `fix/57-config-window`
- `docs/<任务号>-<简短描述>`：文档修改，例如 `docs/63-release-guide`
- `hotfix/<版本号>-<简短描述>`：已发布版本的紧急修复，例如 `hotfix/0.2.1-startup-crash`
- `refactor/<任务号>-<简短描述>`：重构代码结构，不改变外部行为，例如 `refactor/71-split-pet-view`
- `style/<任务号>-<简短描述>`：纯格式或代码风格调整，不改变逻辑，例如 `style/74-format-python-files`

任务号可使用 GitHub Issue 编号；没有 Issue 时可以省略。分支合并后及时删除。

默认不创建长期的 `develop` 或 `release` 分支。只有在一个版本需要集中验收、同时 `main` 还要继续接收其他开发时，才临时创建 `release/0.2.0`；该分支只用于稳定性修复，发布后删除。否则直接在 `main` 上完成验收并打版本标签。

### 3. 示例：从 0.1.0 发布到 0.2.0

以下版本号仅用于演示，实际发布时应根据当前版本和发布计划替换；命令中的 `<...>` 是占位符，执行前须替换为实际内容。示例使用 `origin` 作为远程仓库，并假设操作前工作区已清理；执行 `git status` 检查，避免覆盖未提交的工作。

#### 确定范围并开发

在版本计划中列出功能、修复和验收标准；未完成或未通过验收的功能不纳入本次发布。开发者从最新 `main` 创建短生命周期分支，例如：

```bash
# 切换到主分支
git switch main
# 拉取合并：git pull = git fetch & git merge
git pull --ff-only origin main
# 创建并切换新分支
git switch -c feat/42-pet-heartbeat

# 完成功能后，检查并提交指定文件
npm run lint
npm run typecheck
git add <修改的文件>
git commit -m "feat: add pet heartbeat"
git push -u origin feat/42-pet-heartbeat
```

在 GitHub 上创建指向 `main` 的 PR，审查、测试并合并。涉及共享接口或重叠文件时，先通过 PR 合并共同部分，其他分支再基于最新 `main` 开发。

如果开发期间 `main` 有更新，合并前在功能分支执行：

```bash
git fetch origin
git rebase origin/main
```

如有冲突，解决后执行 `git add <已解决的文件>` 和 `git rebase --continue`；需要放弃本次变基时执行 `git rebase --abort`。如果已经推送过该分支，变基完成后用 `git push --force-with-lease` 更新自己的远程分支，并先与其他使用该分支的人协调。

#### 发布 Alpha

功能和修复合并后，创建版本更新分支。`npm version` 同时更新 `package.json` 和 `package-lock.json`；`--no-git-tag-version` 避免自动提交或打标签。

```bash
git switch main
git pull --ff-only origin main
git switch -c docs/release-0.2.0-alpha.1

npm version 0.2.0-alpha.1 --no-git-tag-version
npm run lint
npm run typecheck
git add package.json package-lock.json
git commit -m "chore: prepare 0.2.0-alpha.1"
git push -u origin docs/release-0.2.0-alpha.1
```

创建指向 `main` 的 PR，确认版本号、审查并合并。记录 GitHub 显示的**合并后提交 SHA**；即使合并后 `main` 又有新提交，也要从这个已验收的提交构建和打标签，而不是盲目使用最新 `main`：

```bash
git fetch origin
git switch --detach <版本PR合并后的提交SHA>
node -p "require('./package.json').version"
npm run lint
npm run typecheck

# 在对应平台选择一条命令生成安装包
npm run build:mac
# npm run build:win
# npm run build:linux
```

确认输出版本为 `0.2.0-alpha.1`，并测试安装包能正常安装和启动。验收通过后，在同一提交打标签并推送：

```bash
git tag -a v0.2.0-alpha.1 -m "Release v0.2.0-alpha.1"
git push origin v0.2.0-alpha.1
git switch main
```

在 GitHub 创建 Release，选择 `v0.2.0-alpha.1`，填写发布说明并上传对应安装包，勾选预发布。不要移动或覆盖已发布的标签。

#### 修复问题并推进到正式版

Alpha 测试发现问题时，从最新 `main` 创建 `fix/...` 分支，修复、测试并通过 PR 合并；然后重复上面的版本更新、PR、验收、打标签和发布流程。每个版本都使用对应的版本 PR 合并提交，不复用旧安装包：

| 情况                     | `npm version` 命令                               | 对应标签         |
| ------------------------ | ------------------------------------------------ | ---------------- |
| Alpha 修复后重新测试     | `npm version 0.2.0-alpha.2 --no-git-tag-version` | `v0.2.0-alpha.2` |
| 功能冻结，开始 Beta 公测 | `npm version 0.2.0-beta.1 --no-git-tag-version`  | `v0.2.0-beta.1`  |
| Beta 修复后需要再次公测  | `npm version 0.2.0-beta.2 --no-git-tag-version`  | `v0.2.0-beta.2`  |
| 问题收敛，开始 RC 验收   | `npm version 0.2.0-rc.1 --no-git-tag-version`    | `v0.2.0-rc.1`    |
| RC 发现阻止发布的问题    | `npm version 0.2.0-rc.2 --no-git-tag-version`    | `v0.2.0-rc.2`    |
| RC 验收通过，正式发布    | `npm version 0.2.0 --no-git-tag-version`         | `v0.2.0`         |

Beta、RC 同样在 GitHub Release 中标记为预发布；正式版不勾选预发布。RC 阶段不再添加新功能。正式版也要从其版本 PR 合并提交重新构建、验收，再打 `v0.2.0` 标签。

#### 可选：使用临时发布分支

如果验收期间 `main` 还要接收不属于 `0.2.0` 的开发，从已确定的发布范围创建发布分支：

```bash
git switch main
git pull --ff-only origin main
git switch -c release/0.2.0
git push -u origin release/0.2.0
```

此后将稳定性修复和各阶段版本更新的 PR 指向 `release/0.2.0`，并在该分支对应的版本 PR 合并提交上构建、验收和打标签。正式发布后，将修复通过 PR 合并回 `main`；如果 `main` 已推进到其他版本，解决版本文件冲突时保留其正确版本，避免回退。确认修复已合并后删除发布分支。

#### 已发布版本的紧急修复

例如从正式版 `v0.2.0` 修复启动问题：

```bash
git fetch origin --tags
git switch -c hotfix/0.2.1-startup-crash v0.2.0

# 修复并测试后
npm version 0.2.1 --no-git-tag-version
npm run lint
npm run typecheck
git add <修复的文件> package.json package-lock.json
git commit -m "fix: resolve startup crash"
git push -u origin hotfix/0.2.1-startup-crash
```

从经过审查和测试的 hotfix 提交构建、验收安装包，然后打 `v0.2.1` 标签并创建正式 Release：

```bash
# 选用适合发布平台的打包命令，并检查生成的安装包
npm run build:mac
# npm run build:win
# npm run build:linux
node -p "require('./package.json').version"
git tag -a v0.2.1 -m "Release v0.2.1"
git push origin v0.2.1
```

同时创建 PR 将修复合并回 `main`；若 `main` 已包含更新的版本号，解决冲突时保留 `main` 的正确版本，不要将其回退为 `0.2.1`。

### 4. 发布检查与记录

正式发布前至少确认：

- 本次版本计划中的功能和修复均已验收；
- 核心使用流程通过测试，安装包能够正常安装和启动；
- 已知问题和升级注意事项已写入发布说明；
- 项目版本号与 Git 标签一致，标签格式为 `v<版本号>`，例如 `v0.2.0`；
- 发布说明包含新增功能、问题修复、已知问题和安装包。

版本号以根目录 `package.json` 为统一来源；其他部分不要另行维护不一致的版本号。正式发布后，将源码标签和对应安装包关联到 GitHub Release。

### 5. 已发布版本的紧急修复

已发布版本出现影响使用的严重问题时，从受影响的发布版本创建 `hotfix/<版本号>-<简短描述>` 分支，修复并测试后发布 PATCH 版本。例如 `v0.2.0` 修复后发布 `v0.2.1`。修复也必须合并回 `main`，避免后续版本再次出现相同问题。
