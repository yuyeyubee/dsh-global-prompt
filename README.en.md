# DSH Global Prompt

> Write once, applied everywhere: inject your own prompt into every DeepSeek Harness session's system prompt.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![DSH](https://img.shields.io/badge/DeepSeek%20Harness-plugin-5c4ee5)](https://github.com/deepseek-ai/deepseek-harness)

[中文](README.md) | **English**

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) plugin. It registers one user-authored prompt as an **early system-prompt section** that loads in every session — main sessions, subagent sessions, and teammate sessions — and adds a **Settings → Global Prompt** page to edit it. Saving applies to the next model request; no restart needed.

Use it for long-lived preferences: answer language, code style, safety boundaries, or a standard workflow you would otherwise repeat at the start of every conversation.

---

## Features

- **Applies to every session**: the prompt is added before each session's first model request, including subagent and teammate sessions.
- **Editable in Settings**: `Settings → Global Prompt`; a save takes effect on the **next model request**, and sessions already open pick it up on their next turn.
- **Single-file persistence**: stored in `~/.dsh/global-prompt.md` (override with `DSH_HOME`); the Host half is the only read/write path.
- **Literal injection**: injected as plain text, so `{{...}}` is never interpolated — safe for code snippets and template syntax.
- **Bilingual UI**: the Settings page and plugin metadata follow the DSH locale (English / Simplified Chinese).
- **No third-party dependencies**: Node.js builtins only; nothing to `pnpm add` at runtime.
- **Safe writes**: atomic replace (temp file + rename), so readers never see a partial file; cached by mtime and re-read when the file changes.
- **64 KiB limit** (UTF-8 bytes); oversized saves are rejected with `413`.

## Requirements

- **DeepSeek Harness** (Desktop or Web).
- The Settings page requires the Web composition (`dsh.client.platform: web`). Under a headless composition the prompt is still injected, but there is no Settings page.
- No separate Node.js install and no npm packages — the plugin runs inside the DSH Host process.

## Installation

The plugin is a local bundle linked into a DSH profile. The plugin manager is the simplest route.

### Option 1: Plugin manager (recommended)

1. Clone into a stable directory (do not move or delete it afterwards):

   ```bash
   git clone https://github.com/yuyeyubee/dsh-global-prompt.git ~/.dsh/local-bundles/dsh-global-prompt
   ```

2. In DSH, install the local bundle: ask the agent to call `plugin_manager`'s `install_bundle` with that directory's absolute path, or pick the directory in the plugin-management UI.
3. Refresh DSH (restart if necessary). `Settings → Global Prompt` should now appear.

### Option 2: Edit the profile manually

Use this if you prefer to manage the profile yourself. Edit `~/.dsh/profiles/<profile>/package.json`:

```jsonc
{
  "dependencies": {
    "@local/global-prompt": "link:/Users/you/.dsh/local-bundles/dsh-global-prompt"
  },
  "dsh": {
    "profile": {
      "bundles": [
        // ...existing bundles
        "@local/global-prompt"
      ]
    }
  }
}
```

Then install dependencies in the profile directory and restart DSH:

```bash
cd ~/.dsh/profiles/desktop && pnpm install
```

> Both options use `link:` semantics: the repository directory *is* the plugin. Moving or deleting it breaks the plugin.

## Usage

1. Open **Settings → Global Prompt**.
2. Write your prompt and click **Save**. You will see "Saved. It applies from the next model request on."
3. Click **Clear** to remove it. An empty prompt loads nothing (whitespace-only content is treated as empty too).
4. You can also edit `~/.dsh/global-prompt.md` directly; external edits are picked up on the next read when the mtime changes.

Example prompt:

```text
- Always answer in English; keep code comments in English.
- Explain the plan before editing code; remind me to commit with a descriptive message afterwards.
- Never run destructive commands (rm -rf, git reset --hard, ...) unless I explicitly ask.
```

## Data and API

| Item | Location / notes |
| --- | --- |
| Prompt file | `~/.dsh/global-prompt.md`, or `$DSH_HOME/global-prompt.md` when `DSH_HOME` is set |
| Read route | `GET /api/global-prompt` → `{ ok: true, prompt }` |
| Write route | `POST /api/global-prompt` with `{ "prompt": "..." }` |
| Auth | Routed through DSH's Connection; same-origin authenticated requests only |
| Limit | 64 KiB (UTF-8 bytes) |

The routes are registered only in a Web composition (the plugin injects the `connection` service); a headless composition exposes no route.

## How it works

The plugin has a Host half and a Client half:

| Part | File | Responsibility |
| --- | --- | --- |
| Host | `index.js` | Reads the prompt file; registers `systemPrompt.section` (`name: global-prompt:user`, `order: 100`, `interpolate: false`); registers authenticated `GET/POST /api/global-prompt` routes in a Web composition. |
| Client | `client.js` | Registers the Settings page via `settings.section`; all reads/writes go through the Host route, so there is no second persistence path. |
| Bundle | `cordis.patch.yml` | Inserts the `global-prompt` Host row into the loader tree. |
| Metadata | `package.json` | Declares `dsh.bundle` (patch) and `dsh.client` (web platform; injects `locale`, `settings`, and `sidebar` client services). |
| Strings / icon | `locale/*.json`, `icon.svg` | Plugin title and description (en / zh) and the sidebar icon. |

Injection happens during system-prompt assembly (`order: 100`, an early section), so every session and subagent carries the prompt before its first model request. The file is cached by mtime, so unchanged content is not re-read on every request.

## Layout

```
dsh-global-prompt/
├── index.js            # Host half: prompt section + authenticated route
├── client.js           # Client half: Settings page
├── cordis.patch.yml    # Bundle patch: inserts the Host row
├── package.json        # Bundle manifest (dsh.bundle / dsh.client)
├── icon.svg            # Sidebar / Settings icon
└── locale/             # Plugin metadata strings (en, zh)
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No "Global Prompt" in Settings | Is `@local/global-prompt` in the profile's `dsh.profile.bundles`? Is `dsh.client.platform` `web`? Refresh or restart DSH; confirm the `link:` target exists. |
| Page opens but saving fails | Is the profile directory writable? Check the Host log; confirm `~/.dsh` or `DSH_HOME` is writable. |
| Prompt has no effect | Is it empty or whitespace-only? Was the file actually written? Under headless, injection works but there is no Settings page. |
| `413` on save | Content exceeds 64 KiB — trim or split it. |
| `{{...}}` is not replaced | By design: the prompt is injected literally, with no template interpolation. |

## Development

There is no build step; the source is the artifact. `index.js` and `client.js` are ESM, and `client.js` is loaded at runtime by DSH's web module loader. `index.js` exports `internals` (`dshHome`, `promptPath`, `readPrompt`, `writePrompt`, `handleRoute`, `MAX_PROMPT_BYTES`, `ROUTE_PATH`) for tests and debugging.

## License

[MIT](./LICENSE) © 2026 yuyeyubee
