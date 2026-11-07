# DSH Global Prompt · 全局提示词

给 [DeepSeek Harness](https://github.com/deepseek-ai) 用的一个插件：把一段你自己写的「全局提示词」自动注入到**每一个会话**的系统提示词里，并提供一个设置页随时编辑它。

A plugin for DeepSeek Harness that injects one user-authored "global prompt" into the system prompt of **every session**, with a built-in Settings page to edit it.

---

## 功能特性 / Features

- **一次编写，处处生效**：全局提示词会作为系统提示词的一个 section，在每个会话（包括子代理、teammate 的会话）的第一次模型请求之前加载。
- **设置页直接编辑**：`设置 → 全局提示词`，保存后下一次模型请求即生效，无需重启。
- **单文件持久化**：内容存放在 `~/.dsh/global-prompt.md`（可用 `DSH_HOME` 覆盖），Host 端是唯一的读写路径。
- **中英文界面**：跟随 DSH 的语言设置自动切换。
- **零额外依赖**：只使用 Node 内置模块，不需要安装任何第三方包。
- **字面量注入**：提示词按纯文本注入，`{{...}}` 不会被模板插值。

- **Write once, applies everywhere**: the prompt is registered as an early system-prompt section, loaded before each session's first model request — including subagent and teammate sessions.
- **Edit in Settings**: `Settings → Global Prompt`; changes apply on the next model request, no restart needed.
- **Single-file persistence**: stored in `~/.dsh/global-prompt.md` (overridable via `DSH_HOME`); the Host half is the only read/write path.
- **Bilingual UI**: English and Simplified Chinese, following the DSH locale.
- **No dependencies**: Node builtins only.
- **Literal injection**: the prompt is injected as plain text; `{{...}}` is never interpolated.

## 安装 / Installation

DSH 插件以「bundle」形式挂载到 profile 上。本仓库尚未发布到 npm，推荐从源码用 `link:` 方式安装。

Plugins are loaded as bundles into a DSH profile. This repo is not published to npm, so install it from source with a `link:` specifier.

1. 克隆仓库：

   ```bash
   git clone https://github.com/yuyeyubee/dsh-global-prompt.git ~/dsh-global-prompt
   ```

2. 编辑你的 profile 配置（例如 `~/.dsh/profiles/desktop/package.json`），把包加入 `dependencies` 和 `dsh.profile.bundles`：

   ```jsonc
   {
     "dependencies": {
       "@local/global-prompt": "link:/Users/you/dsh-global-prompt"
     },
     "dsh": {
       "profile": {
         "bundles": [
           // ... 已有的 bundles
           "@local/global-prompt"
         ]
       }
     }
   }
   ```

3. 在 profile 目录下安装依赖：

   ```bash
   cd ~/.dsh/profiles/desktop && pnpm install
   ```

4. 重启 DSH，打开 `设置 → 全局提示词` 即可编辑。

### 使用 / Usage

- 打开 `设置 → 全局提示词`，写入内容并保存。
- 留空表示不加载任何内容。
- 内容保存在 `~/.dsh/global-prompt.md`，你也可以直接编辑这个文件（保存后下一个模型请求生效）。

## 工作原理 / How it works

插件分成 Host 和 Client 两半：

| 部分 | 文件 | 职责 |
| --- | --- | --- |
| Host | `index.js` | 读取提示词文件，注册 `systemPrompt.section`（order 100）；在 Web 组合下注册认证过的 `GET/POST /api/global-prompt` 路由。 |
| Client | `client.js` | 在 `settings.section` 注册设置页，通过上面的路由读写提示词。 |
| Bundle | `cordis.patch.yml` | 把 Host 行 `global-prompt` 插入 loader 树。 |
| 文案 / 图标 | `locale/*.json`, `icon.svg` | 插件元信息、中英文名称与描述、侧边栏图标。 |

提示词文件带 mtime 缓存：文件未变化时复用上次读取的内容，变化后自动重新读取。写入采用「临时文件 + rename」的原子替换，避免读到半截内容。

The prompt file is cached by mtime and re-read after changes. Writes are atomic (temp file + rename), so readers never observe a partial file.

## 目录结构 / Layout

```
dsh-global-prompt/
├── index.js            # Host half: prompt section + authenticated route
├── client.js           # Client half: Settings page
├── cordis.patch.yml    # Bundle patch: inserts the Host row
├── package.json        # Bundle manifest (dsh.bundle / dsh.client)
├── icon.svg            # Sidebar / settings icon
└── locale/             # Plugin meta locale (en, zh)
```

## 许可 / License

[MIT](./LICENSE) © 2026 yuyeyubee
