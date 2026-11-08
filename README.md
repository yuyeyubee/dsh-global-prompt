# DSH Global Prompt · 全局提示词

> 写一次，处处生效：把你的一段全局提示词注入到 DeepSeek Harness 每个会话的系统提示词里。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![DSH](https://img.shields.io/badge/DeepSeek%20Harness-plugin-5c4ee5)](https://github.com/deepseek-ai/deepseek-harness)

**中文** | [English](README.en.md)

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）插件。它把你写的一段提示词作为**系统提示词的一个 section**，加载到每个会话中——包括主会话、子代理（subagent）和 teammate 的会话；同时提供「设置 → 全局提示词」页面，随时编辑、保存即生效。

适合把长期偏好（回答语言、代码风格、安全边界、工作流程）一次写清楚，而不必在每个新会话开头重复交代。

---

## 功能

- **全会话生效**：提示词在每个会话的第一次模型请求之前进入系统提示词，子代理 / teammate 会话同样加载。
- **设置页编辑**：`设置 → 全局提示词`，保存后**下一次模型请求**即生效，无需重启 DSH；已打开的会话也会在下一轮使用新内容。
- **单文件持久化**：内容保存在 `~/.dsh/global-prompt.md`（可用 `DSH_HOME` 覆盖），Host 端是唯一读写路径。
- **字面量注入**：按纯文本注入，`{{...}}` 不会被模板插值，适合放代码片段、模板语法。
- **中英文界面**：设置页与插件描述跟随 DSH 的语言设置自动切换。
- **零第三方依赖**：只使用 Node.js 内置模块，不需要 `pnpm add` 任何运行时包。
- **写入安全**：采用「临时文件 + rename」原子替换，读取方不会看到半截内容；按 mtime 缓存，文件变化后自动重读。
- **长度上限 64 KiB**（UTF-8 字节），超限时接口返回 `413`。

## 环境要求

- 已安装 **DeepSeek Harness**（Desktop / Web 版）。
- 设置页依赖 Web 组合（`dsh.client.platform: web`）；headless 组合下插件仍会注入提示词，但没有设置页。
- 不需要额外安装 Node.js 或任何 npm 包——插件运行在 DSH 的 Host 进程中。

## 安装

插件以本地 bundle 形式挂载到 DSH profile。推荐直接使用插件管理：

### 方式一：插件管理（推荐）

1. 克隆到固定目录（安装后不要移动或删除）：

   ```bash
   git clone https://github.com/yuyeyubee/dsh-global-prompt.git ~/.dsh/local-bundles/dsh-global-prompt
   ```

2. 在 DSH 中安装本地 bundle：让 Agent 调用 `plugin_manager` 的 `install_bundle`，目标填上面目录的绝对路径；或在 DSH 的插件管理页面选择该目录安装。
3. 刷新 DSH 页面（必要时重启），`设置 → 全局提示词` 即可出现。

### 方式二：手动编辑 profile

适合想自己控制 profile 文件的情况。编辑 `~/.dsh/profiles/<profile>/package.json`：

```jsonc
{
  "dependencies": {
    "@local/global-prompt": "link:/Users/you/.dsh/local-bundles/dsh-global-prompt"
  },
  "dsh": {
    "profile": {
      "bundles": [
        // ...原有的 bundles
        "@local/global-prompt"
      ]
    }
  }
}
```

然后在 profile 目录安装依赖并重启 DSH：

```bash
cd ~/.dsh/profiles/desktop && pnpm install
```

> 两种方式都是 `link:` 语义：仓库目录就是插件本体，移动或删除目录会导致插件失效。

## 使用方法

1. 打开 **设置 → 全局提示词**。
2. 在文本框中写入提示词，点击「保存」。保存成功后提示「已保存，将从下一次模型请求开始生效」。
3. 点击「清空」可移除提示词；留空表示不注入任何内容（纯空白内容同样视为空）。
4. 也可以直接编辑文件 `~/.dsh/global-prompt.md`，外部修改会在下一次读取时通过 mtime 变化被感知。

示例提示词：

```text
- 始终使用简体中文回答；代码注释保持英文。
- 修改代码前先说明计划，改完提醒我提交 git（提交信息用中文）。
- 不要执行破坏性命令（rm -rf、git reset --hard 等），除非我明确要求。
```

## 数据与接口

| 项目 | 位置 / 说明 |
| --- | --- |
| 提示词文件 | `~/.dsh/global-prompt.md`；设置 `DSH_HOME` 时为 `$DSH_HOME/global-prompt.md` |
| 读取接口 | `GET /api/global-prompt` → `{ ok: true, prompt }` |
| 保存接口 | `POST /api/global-prompt`，body 为 `{ "prompt": "..." }` |
| 认证 | 走 DSH 的 Connection，只接受同源已认证请求 |
| 上限 | 64 KiB（UTF-8 字节） |

接口只在 Web 组合下注册（插件注入 `connection` 服务），headless 组合不暴露路由。

## 工作原理

插件分成 Host 和 Client 两半：

| 部分 | 文件 | 职责 |
| --- | --- | --- |
| Host | `index.js` | 读取提示词文件；注册 `systemPrompt.section`（`name: global-prompt:user`、`order: 100`、`interpolate: false`）；在 Web 组合下注册 `GET/POST /api/global-prompt` 路由。 |
| Client | `client.js` | 通过 `settings.section` 注册设置页；读写都走上面的 Host 路由，不存在第二条持久化路径。 |
| Bundle | `cordis.patch.yml` | 把 Host 行 `global-prompt` 插入 loader 树。 |
| 元信息 | `package.json` | 声明 `dsh.bundle`（patch）与 `dsh.client`（web 平台、注入 `locale` / `settings` / `sidebar` 客户端服务）。 |
| 文案 / 图标 | `locale/*.json`、`icon.svg` | 插件名称与描述（中/英）、侧边栏图标。 |

注入时机是系统提示词组装阶段（`order: 100` 属于较早的 section），因此每个会话、每个子代理在首次模型请求前都会带上这段内容；文件按 mtime 缓存，未变化时不重复读盘。

## 目录结构

```
dsh-global-prompt/
├── index.js            # Host 半：提示词 section + 认证路由
├── client.js           # Client 半：设置页
├── cordis.patch.yml    # Bundle patch：插入 Host 行
├── package.json        # Bundle 清单（dsh.bundle / dsh.client）
├── icon.svg            # 侧边栏 / 设置页图标
└── locale/             # 插件元信息文案（en, zh）
```

## 排查

| 现象 | 检查 |
| --- | --- |
| 设置里没有「全局提示词」 | profile 的 `dsh.profile.bundles` 是否包含 `@local/global-prompt`；`dsh.client.platform` 是否为 `web`；刷新或重启 DSH；确认 `link:` 目录存在。 |
| 页面能打开但保存报错 | profile 目录是否可写；查看 Host 日志；确认 `~/.dsh` 或 `DSH_HOME` 有写权限。 |
| 提示词没有生效 | 内容是否为空 / 纯空白；文件是否确实写入；headless 组合下正常（只有注入，没有设置页）。 |
| 保存提示 413 | 内容超过 64 KiB，拆分或精简。 |
| `{{...}}` 没被替换 | 这是设计行为：提示词按字面量注入，不做模板插值。 |

## 开发

无构建步骤，源码即产物：`index.js` / `client.js` 为 ESM，`client.js` 由 DSH 的 Web 模块加载器在运行时加载。`index.js` 末尾导出了 `internals`（`dshHome`、`promptPath`、`readPrompt`、`writePrompt`、`handleRoute`、`MAX_PROMPT_BYTES`、`ROUTE_PATH`），便于写测试或调试。

## 许可

[MIT](./LICENSE) © 2026 yuyeyubee
