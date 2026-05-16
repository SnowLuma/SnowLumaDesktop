# SnowLumaDesktop · Implementation Plan

来源：2026-05-16 grill-me 设计 session，全部决策见本文档末尾的"决策总览"附录。

---

## 0. 涉及的仓库

| Repo | 本地路径 | GitHub | 角色 |
|---|---|---|---|
| **SnowLuma** (主 monorepo) | `/Users/motricseven/SnowLuma` | `SnowLuma/SnowLuma` | 寄存 `@snowluma/core`、`webui`、`sdk`、新增 `@snowluma/ui` |
| **SnowLumaDesktop** | `/Users/motricseven/SnowLuma/dev/SnowLumaDesktop` | `SnowLuma/SnowLumaDesktop` | 本项目独立 repo；通过 npm 消费 `@snowluma/ui`，本地 dev 用 `pnpm overrides` 软链 |

⚠️ **本地路径 ≠ GitHub 结构**。安装依赖时 `pnpm i` 必须在两个仓的根目录分别跑，不要把 Desktop 当成主 monorepo 的子包。

---

## Phase 0 · 主 monorepo 前置改动

Desktop 依赖以下主 monorepo 端的工作，可与 Phase 1 并行推进，但**真正能跑起来需要这些先 land**。

### 0.1 新建 `packages/ui` 共享 UI 库

- **位置**：`packages/ui/`（被 `pnpm-workspace.yaml` 的 `packages/*` 自动 picked up）
- **包名**：`@snowluma/ui`
- **发布**：跟 `@snowluma/sdk` 一个模式（npm，scoped public/private 待定）
- **内容边界**：
  - ✅ Tailwind 4 theme tokens（颜色 / 圆角 / 间距 / 暗色模式 CSS 变量）
  - ✅ shadcn 原子组件（Button、Dialog、Input、Select、Toast、Tooltip、ScrollArea、Separator、Label、AlertDialog —— 直接从 webui 的 `components/ui/` lift 过来）
  - ✅ `cn`、`clsx + tailwind-merge` 包装
  - ❌ 业务组件（BotStatusBadge 之类）
  - ❌ 应用布局（Sidebar、AppShell）
  - ❌ 路由 / 状态管理 hooks
- **构建**：`tsup` 编 ESM dist + `.d.ts`
- **Tailwind 4 集成**：使用 Tailwind 4 的 `@source` 指令；消费方在自己的 css 入口加 `@source '../node_modules/@snowluma/ui/dist/**/*.js'`
- **迁移**：webui 后续切到从 `@snowluma/ui` 消费（不在本 phase 强制）

### 0.2 对 core 的 PR（三个，按优先级）

1. **`SNOWLUMA_WEBUI_PORT` 环境变量**
   - 让 Desktop spawn core 时能注入端口
   - 跟 `SNOWLUMA_HOOK_RUNTIME_DIR` / `SNOWLUMA_WEBUI_TRUST_PROXY` 是一套风格
   - 修改：`packages/core/src/common/runtime.ts` + `packages/core/src/webui/port.ts`

2. **per-UIN 数据子目录支持**
   - 当前 core 的 `config/` 和 `data/` 是 CWD 顶层；改为支持 `bots/<UIN>/{config,data,logs}` 的隔离布局
   - 单 core 进程跑多 Bot 时，每个 Bridge 操作自己的 per-UIN 目录
   - 修改面较大，建议先做 ADR

3. **webui 自动登录 token 注入接口**
   - core 启动时接受一个 `SNOWLUMA_WEBUI_BOOTSTRAP_TOKEN` 或类似环境变量
   - Desktop 在第一次启动 core 时随机生成密码 + token，写入 core 配置 + 自己 electron-store
   - BrowserWindow 加载 webui 前把 token 注入 localStorage / cookie

### 0.3 QQ 兼容性 manifest 端点

- 文件位置：`compat/qq.json` 在 SnowLuma 主仓 main 分支
- 暴露 URL：`https://raw.githubusercontent.com/SnowLuma/SnowLuma/main/compat/qq.json`
- 初始内容：`{ "allowAll": true, "knownGoodVersions": [], "knownBadVersions": [], "minVersion": null }`
- Desktop 启动时拉一次 + 缓存到 electron-store，3 天后再拉

### 0.4 webui per-Bot 视图改造（**下一轮单独讨论**，本 PR 不做）

Desktop 主窗以 `http://127.0.0.1:port/?botUin=<UIN>` 加载 webui 时，webui 需要识别这个 query 参数并切换到对应 Bot 视图。当前 webui 是全局视图，**需要单独写 ADR 讨论改造方案**。

---

## Phase 1 · Desktop 骨架（在 `dev/SnowLumaDesktop/`）

目标：跑得起来的 hello world，包含主窗 + 托盘 + 单实例锁 + tRPC IPC。不接 core、不接 webui，纯壳。

### 1.1 项目初始化

- `package.json`：electron、electron-vite、electron-builder、electron-updater、electron-store、electron-trpc、@trpc/server、@trpc/client、@trpc/react-query、@tanstack/react-query、@tanstack/react-router、jotai、react、react-dom、tailwindcss(@4)、@tailwindcss/vite、lucide-react、i18next、react-i18next、motion、class-variance-authority、clsx、tailwind-merge
- dev：typescript、@types/\*、vitest、@vitejs/plugin-react、eslint
- `engines.node >= 22`，`pnpm@10.x`
- `type: "module"`

### 1.2 配置

- `electron.vite.config.ts`：三个 entry（main / preload / renderer），TS path aliases，tailwind vite plugin
- `tsconfig.json` + `tsconfig.node.json`：strict，moduleResolution bundler，paths 别名
- `.gitignore`：node_modules、dist、out、release、.electron-builder.cache
- `electron-builder.yml`：先放占位，Phase 5 才正式配

### 1.3 `src/` 布局

```
src/
  main/                      # Electron 主进程（Node 上下文）
    index.ts                 # 应用入口：单实例锁、主窗创建、托盘、生命周期
    trpc/                    # tRPC procedures（按领域分文件）
      router.ts              # appRouter root
      bot.ts                 # Bot CRUD（Phase 3+）
      core.ts                # core 进程控制（Phase 2）
      wizard.ts              # 向导步进 state（Phase 3）
      app.ts                 # Desktop 自身（版本、退出、更新）
      context.ts             # createContext
    ipc/
      bridge.ts              # electron-trpc handler 挂载
    store/
      schema.ts              # electron-store 的 schema 类型
      store.ts               # 单例 store
    services/                # Phase 2+ 填充
      core-manager.ts
      bot-manager.ts
      download-manager.ts
      av-checker.ts
      diagnostic.ts
      updater.ts
    util/
      logger.ts              # Desktop 自己的日志（写到 %APPDATA%/SnowLumaDesktop/logs/）
      paths.ts               # 数据/安装/便携路径解析
    tray.ts                  # 托盘菜单
  preload/
    index.ts                 # 暴露 electron-trpc client + 受限的 ipcRenderer
  renderer/                  # Electron 渲染进程（Chromium）
    index.html
    main.tsx                 # React 入口
    App.tsx                  # 顶层路由 + i18n + tRPC provider
    state/                   # Jotai atoms
      bots.ts
      wizard.ts
      core.ts
      app.ts
    routes/                  # TanStack Router 路由
      __root.tsx
      index.tsx              # 主窗（套 webui iframe）—— Phase 4
      wizard/                # 向导 8 屏 —— Phase 3
      logs.tsx               # Desktop 自己的日志 tab —— Phase 6
      settings.tsx           # 设置 —— Phase 6
    i18n/
      index.ts               # i18next init
      zh-CN.json
      en-US.json             # 占位空文件
    styles/
      globals.css            # Tailwind 4 入口 + 主题 token
  shared/                    # main + renderer 共用
    types.ts                 # 跨进程类型
    constants.ts
```

### 1.4 Phase 1 完成标准

- `pnpm dev` 启动 Electron，看到一个 Hello SnowLuma 窗口
- 托盘有图标 + 一个"退出"菜单项
- 单实例锁生效（第二次启动激活第一个）
- tRPC IPC 通：renderer 调一个 `app.version` procedure 拿到版本号
- TypeScript 严格模式过

---

## Phase 2 · core 进程管理

依赖 Phase 0.2 的 `SNOWLUMA_WEBUI_PORT` 落地。

### 2.1 下载管理

- `services/download-manager.ts`：
  - 镜像清单（electron-store 持久化，初始内含若干公益镜像 + 优先级）
  - 下载 core 包：从 GH Releases / 镜像拉 `.tar.gz` 或 `.zip`
  - SHA256 校验
  - 解压到 `%APPDATA%/SnowLumaDesktop/core/versions/<ver>/`
  - 失败重试 + 切换下一个镜像
  - 暴露给 tRPC：`core.downloadVersion(version)`、`core.listVersions()`、`core.activeVersion()`、`core.switchVersion(version)`
- QQ manifest 拉取同样的下载工具

### 2.2 core 进程生命周期

- `services/core-manager.ts`：
  - spawn `<node-binary>` + `<active-core>/index.mjs`
  - cwd = `%APPDATA%/SnowLumaDesktop/runtime/`
  - env：`SNOWLUMA_WEBUI_PORT=<allocated>`、`SNOWLUMA_HOOK_AUTOLOAD=1`（如 4b-i Bot 全 Desktop 管时）、`SNOWLUMA_WEBUI_BOOTSTRAP_TOKEN=<random>`
  - 捕获 stdout/stderr → Desktop logger
  - 监听 exit：永远自动重启，重启间隔指数退避（5s → 10s → 30s → 60s → cap 5min），不带 cap 因为没 core 整个 Desktop 没用
  - 健康检查：`GET http://127.0.0.1:<port>/health`（如果 core 没这个端点，下个 ask）
- 状态机：`stopped → starting → running → crashed → restarting → ...`
- 暴露 tRPC：`core.status()`（subscription）、`core.restart()`、`core.stop()`

### 2.3 独立 Node 二进制打包

- 把 Node 二进制（matched version）放进 Electron `resources/node/win-x64/node.exe`
- electron-builder `extraResources` 配置
- `core-manager` 优先用这个 path，找不到回退到 `process.execPath`（开发模式）

### 2.4 Phase 2 完成标准

- 能从镜像下个测试用的 core tarball，校验解压
- spawn core，看到 stdout 流到 Desktop log
- kill 子进程，看到自动重启
- 切换 core 版本，能切

---

## Phase 3 · 首启向导（8 屏）

### 3.1 状态机

- `wizardStep` 持久化在 electron-store：`'welcome' | 'network' | 'av' | 'core-download' | 'qq-detect' | 'add-bot' | 'prefs' | 'done'`
- `wizardCompletedAt`：完成时间戳；非 null 时跳过向导
- 中断恢复：启动时若 `wizardStep !== 'done' && !wizardCompletedAt` → 渲染向导窗

### 3.2 8 屏内容

| 屏 | 主要操作 | tRPC 调用 |
|---|---|---|
| welcome | 隐私声明 + "我接受" / "我是老用户跳过" | 无 |
| network | 默认折叠"使用推荐镜像"；高级展开镜像 CRUD | `app.mirrors.list/upsert/delete` |
| av | 检测 Defender/360/火绒；弹"一键加白名单"（UAC） | `app.av.detect`、`app.av.whitelist(needsUAC=true)` |
| core-download | 进度条 + 切镜像 + 重试 | `core.downloadVersion(version)` 订阅 |
| qq-detect | 扫注册表 + 默认路径；版本对照 manifest；"我装好了"按钮 | `app.qq.detect` |
| add-bot | 4b/4c per-Bot 偏好 → 启动 QQ → 等登录（轮询 core bridge）→ 拿 UIN | `bot.startAddFlow`、`bot.cancelAddFlow`、`bot.addFlowStatus` 订阅 |
| prefs | 自启开关 + "启动后打开主窗 / 静默到托盘" | `app.prefs.set` |
| done | 进主窗 | `app.wizard.complete` |

### 3.3 Phase 3 完成标准

- 8 屏走通，任意一步关 Desktop 再开能恢复
- "添加第一个 Bot" 整条链路打通（依赖 Phase 2 + Phase 0.2 的 webui token 注入）

---

## Phase 4 · 主窗 UI

### 4.1 布局

- 左 Sidebar：Bot 列表（Jotai-backed），头像 + 名字（14b iii） + 状态点；底部"➕ 添加 Bot"
- 右大区：选中 Bot 的 webui iframe，src = `http://127.0.0.1:<port>/?botUin=<UIN>`（依赖 0.4）
- 顶部薄状态栏：core 进程状态 + 当前 Desktop 版本 + 主菜单按钮
- 无 Bot 在线时主区显示横幅引导添加

### 4.2 Bot CRUD UI

- 添加：复用 Phase 3 的 add-bot 流程
- 重命名：右键 / 长按 → 弹小对话框（14b）
- 删除：对话框 + 名字确认 + 两 checkbox + TG 风格 5s 撤销（toast 含撤销按钮，超时后 mv `.trash/` → rm -rf）
- 重复 UIN：14a 的"已存在，更新偏好？"对话框
- QQ 路径变了：失败时给"重新检测 QQ 路径"按钮

### 4.3 托盘菜单（11b 结构）

```
显示主窗口
─────────
Bot 状态
  🟢 老板号 (12345678) → 暂停/重启/打开 webui
  🔴 测试号 → 启动
  ...（>3 收子菜单）
  ➕ 添加 Bot
─────────
检查更新...
打开日志目录
开机自启 ☑
─────────
⏻ 退出
```

### 4.4 关窗到托盘 + 真退出

- 首次关窗弹一次 toast "Desktop 仍在后台运行..."（electron-store 记 `tray-hint-shown`）
- 右键托盘退出时若有 Bot 在线 → 二次确认

### 4.5 Phase 4 完成标准

- 列表视图 + iframe 切换工作
- 托盘菜单结构对
- 多 Bot 同时启动限并发 2

---

## Phase 5 · 更新与分发

### 5.1 electron-builder 配置

- 平台：win64 only
- 产物：NSIS installer + portable zip（**双出口**）
- 默认安装位置：`%LOCALAPPDATA%/Programs/SnowLumaDesktop`（NSIS 允许用户改路径，默认就是这里）
- 安装目录 vs 数据目录严格分离
- 卸载：默认保留 `%APPDATA%/SnowLumaDesktop/`；NSIS checkbox "同时删除所有 Bot 数据"（默认不勾）

### 5.2 electron-updater

- 渠道：`main`（默认）和 `dev`（prerelease）
- main：GH Releases；electron-updater 直查 `latest.yml`
- dev：GH Releases prerelease；`allowPrerelease: true` 切换
- policy：检查更新 + UI 通知；不自动下载（用户点"更新"才下）
- CI（GH Actions）：tag push 触发 main release；nightly 仅在 since-last-tag 有 commit 时出 prerelease
- 设置 UI 暴露：更新通道（main / dev）、当前版本、检查频率

### 5.3 Phase 5 完成标准

- `pnpm build:installer` 出 NSIS + portable zip
- 在干净 Windows 上能装 + 启动
- 假更新流程能走通（mock 一个 latest.yml）

---

## Phase 6 · 健壮化

### 6.1 诊断导出（8b-iii）

- `services/diagnostic.ts`：聚合 Desktop log、core log、QQ 版本、OS 版本、Defender 状态、AV 进程列表、active core version、Bot 列表（脱敏 UIN → hash）
- 导出 .zip 到用户选的位置 + 复制 issue 模板到剪贴板

### 6.2 错误 UX

- 注入失败分类（同用户/同 IL 检测、AV 拦截可能性提示、需要 UAC 升级提示）
- core 启动失败的引导（端口冲突 → 试下一个端口；core 二进制损坏 → 重下）
- BrowserWindow 加载 webui 失败的"重试 / 强制刷新"页

### 6.3 i18n 完整化

- 所有硬编码字符串过一遍 `t('xxx')`
- ESLint rule 禁止源码出现裸中文（自定义 rule）

### 6.4 老 Bot 导入（14e）

- UI 给"导入已有 Bot"按钮
- 启动时扫 `bots/<UIN>/` 子目录，发现未注册的弹提示

### 6.5 单测（9f）

- `services/*` 全部 pure 逻辑 Vitest 覆盖
- E2E **不做**

---

## 路径速查

| 路径 | 用途 |
|---|---|
| `%LOCALAPPDATA%/Programs/SnowLumaDesktop/` | Desktop.exe + Electron resources + bundled node.exe |
| `%APPDATA%/SnowLumaDesktop/core/versions/<ver>/` | 多版本 core 二进制 |
| `%APPDATA%/SnowLumaDesktop/runtime/` | core 运行时的 CWD（config/、data/、logs/） |
| `%APPDATA%/SnowLumaDesktop/bots/<UIN>/` | per-Bot 配置/数据（依赖 core PR） |
| `%APPDATA%/SnowLumaDesktop/logs/` | Desktop main 自己的日志 |
| `%APPDATA%/SnowLumaDesktop/config.json` | electron-store |
| `%APPDATA%/SnowLumaDesktop/.trash/` | 删 Bot 的 5s 撤销暂存 |

---

## 显式 punt 的事

- macOS / Linux 永不支持
- v1 不签名
- v1 不做遥测后端
- v1 不做 E2E 测试
- 插件管理 UI 直接复用 webui 现有页面
- webui per-Bot 视图改造单开 ADR

---

## 决策总览附录

完整设计裁决：见 2026-05-16 grill-me session 的最终 summary（已存在于 session 历史）。

License：**UNLICENSED**（跟 SDK 一致，留商业化口子）
