/**
 * Global prompt — Client half.
 *
 * Adds one Settings page (`settings.section`) where the user edits the global
 * prompt. Reads and writes go through the authenticated Host route registered
 * by this package's Host half (`api/global-prompt`), so there is no second
 * persistence path: the Host file stays the single source of truth.
 */
window.__ModuleLoader__.load({
  id: '@local/global-prompt',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Document-relative form of the Host route (`/api/global-prompt`). */
    const ROUTE = 'api/global-prompt'
    /** Locale namespace owned by this plugin. */
    const NS = 'global-prompt'

    const LOCALE_DICTS = {
      en: {
        nav: 'Global Prompt',
        title: 'Global Prompt',
        description: 'The text below is loaded as part of the system prompt of every session. Leave it empty to load nothing.',
        label: 'Prompt text',
        placeholder: 'For example: always answer in Simplified Chinese, and keep code comments in English.',
        hint: 'Stored in ~/.dsh/global-prompt.md. Changes apply immediately; open sessions pick them up on their next model request.',
        count: 'characters',
        save: 'Save',
        saving: 'Saving…',
        saved: 'Saved. It applies from the next model request on.',
        cleared: 'Cleared.',
        clear: 'Clear',
        retry: 'Retry',
        loading: 'Loading…',
        loadError: 'Could not load the global prompt',
        saveError: 'Could not save the global prompt',
      },
      zh: {
        nav: '全局提示词',
        title: '全局提示词',
        description: '这里填写的内容会作为系统提示词的一部分，自动加载到每个会话中。留空表示不加载任何内容。',
        label: '提示词内容',
        placeholder: '例如：始终使用简体中文回答，代码注释保持英文。',
        hint: '内容保存在 ~/.dsh/global-prompt.md；修改立即生效，已打开的会话会在下一次模型请求时使用新的提示词。',
        count: '字符',
        save: '保存',
        saving: '保存中…',
        saved: '已保存，将从下一次模型请求开始生效。',
        cleared: '已清空。',
        clear: '清空',
        retry: '重试',
        loading: '正在加载…',
        loadError: '无法加载全局提示词',
        saveError: '无法保存全局提示词',
      },
    }

    /** Scoped styles; every color is a host theme token, mounted with the page. */
    const CSS = `
      .dsh-gp { display: flex; flex-direction: column; gap: 12px; padding: 24px 32px; max-width: 760px; }
      .dsh-gp-title { margin: 0; font-size: 18px; font-weight: 600; line-height: 1.4; color: var(--dsw-alias-label-primary); }
      .dsh-gp-description { margin: 0; font-size: 13px; line-height: 1.7; color: var(--dsw-alias-label-secondary); }
      .dsh-gp-label { margin-top: 4px; font-size: 13px; font-weight: 500; color: var(--dsw-alias-label-primary); }
      .dsh-gp-textarea { box-sizing: border-box; width: 100%; min-height: 240px; resize: vertical; padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; outline: none; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font: inherit; font-size: 14px; line-height: 1.65; }
      .dsh-gp-textarea::placeholder { color: var(--dsw-alias-label-secondary); }
      .dsh-gp-textarea:focus { border-color: var(--dsw-alias-brand-primary); }
      .dsh-gp-textarea:disabled { opacity: 0.6; }
      .dsh-gp-footer { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-secondary); }
      .dsh-gp-hint { flex: 1; }
      .dsh-gp-count { white-space: nowrap; }
      .dsh-gp-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
      .dsh-gp-button { box-sizing: border-box; height: 30px; padding: 0 14px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; cursor: pointer; }
      .dsh-gp-button:not(:disabled):hover { background: var(--dsw-alias-bg-layer-2); }
      .dsh-gp-button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
      .dsh-gp-button:disabled { opacity: 0.5; cursor: default; }
      .dsh-gp-button.dsh-gp-button-primary { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
      .dsh-gp-notice { font-size: 12px; line-height: 1.6; }
      .dsh-gp-notice.is-ok { color: var(--dsw-alias-state-success-primary); }
      .dsh-gp-notice.is-error { color: var(--dsw-alias-state-error-primary); }
      .dsh-gp-muted { margin: 0; font-size: 13px; color: var(--dsw-alias-label-secondary); }
      .dsh-gp-error { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--dsw-alias-state-error-primary); border-radius: 10px; font-size: 13px; color: var(--dsw-alias-label-primary); }
      .dsh-gp-error span { flex: 1; }
    `

    /** `GET` the current prompt through the authenticated Host route. */
    function readPrompt() {
      return fetch(ROUTE, { method: 'GET', credentials: 'same-origin', cache: 'no-store' }).then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok || payload === null || payload.ok !== true) {
          throw new Error(payload !== null && typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`)
        }
        return typeof payload.prompt === 'string' ? payload.prompt : ''
      })
    }

    /** Replace the stored prompt through the authenticated Host route. */
    function savePrompt(prompt) {
      return fetch(ROUTE, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt }),
      }).then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok || payload === null || payload.ok !== true) {
          throw new Error(payload !== null && typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`)
        }
        return typeof payload.prompt === 'string' ? payload.prompt : prompt
      })
    }

    /**
     * Build the page component around the services it needs. `t` reads the
     * active locale at call time and the component subscribes to the locale
     * snapshot so a language switch re-renders it.
     * @param ctx - the Client plugin context.
     * @returns the settings page component.
     */
    function createPage(ctx) {
      const t = ctx.locale.bind(NS)

      return function GlobalPromptPage() {
        React.useSyncExternalStore(
          React.useCallback((listener) => ctx.locale.subscribe(listener), []),
          React.useCallback(() => ctx.locale.getSnapshot(), []),
        )
        const [prompt, setPrompt] = React.useState('')
        const [draft, setDraft] = React.useState('')
        const [phase, setPhase] = React.useState('loading')
        const [busy, setBusy] = React.useState(false)
        const [notice, setNotice] = React.useState(null)
        const noticeTimer = React.useRef(null)

        const flash = React.useCallback((kind, text) => {
          setNotice({ kind, text })
          if (noticeTimer.current !== null) clearTimeout(noticeTimer.current)
          noticeTimer.current = setTimeout(() => {
            noticeTimer.current = null
            setNotice(null)
          }, 5000)
        }, [])

        const load = React.useCallback(() => {
          setPhase('loading')
          readPrompt().then((value) => {
            setPrompt(value)
            setDraft(value)
            setNotice(null)
            setPhase('ready')
          }).catch((error) => {
            setPhase('error')
            setNotice({ kind: 'error', text: `${t('loadError')}: ${String(error.message ?? error)}` })
          })
        }, [t])

        React.useEffect(() => {
          load()
          return () => {
            if (noticeTimer.current !== null) clearTimeout(noticeTimer.current)
          }
        }, [load])

        const persist = (value) => {
          setBusy(true)
          savePrompt(value).then((stored) => {
            setPrompt(stored)
            setDraft(stored)
            setPhase('ready')
            flash('ok', stored.trim() === '' ? t('cleared') : t('saved'))
          }).catch((error) => {
            flash('error', `${t('saveError')}: ${String(error.message ?? error)}`)
          }).finally(() => setBusy(false))
        }

        const dirty = draft !== prompt
        const children = [
          h('style', { key: 'style' }, CSS),
          h('h2', { key: 'title', className: 'dsh-gp-title' }, t('title')),
          h('p', { key: 'description', className: 'dsh-gp-description' }, t('description')),
        ]

        if (phase === 'loading') {
          children.push(h('p', { key: 'status', className: 'dsh-gp-muted' }, t('loading')))
        } else if (phase === 'error') {
          children.push(h('div', { key: 'status', className: 'dsh-gp-error' },
            h('span', null, notice !== null ? notice.text : t('loadError')),
            h('button', { type: 'button', className: 'dsh-gp-button', onClick: load }, t('retry')),
          ))
        }

        // The editor stays visible in every phase, so the page is usable even
        // when the initial read failed.
        children.push(
          h('label', { key: 'label', className: 'dsh-gp-label', htmlFor: 'dsh-gp-textarea' }, t('label')),
          h('textarea', {
            key: 'textarea',
            id: 'dsh-gp-textarea',
            className: 'dsh-gp-textarea',
            value: draft,
            disabled: phase === 'loading',
            placeholder: t('placeholder'),
            spellCheck: false,
            onChange: (event) => setDraft(event.target.value),
          }),
          h('div', { key: 'footer', className: 'dsh-gp-footer' },
            h('span', { className: 'dsh-gp-hint' }, t('hint')),
            h('span', { className: 'dsh-gp-count' }, `${draft.length} ${t('count')}`),
          ),
          h('div', { key: 'actions', className: 'dsh-gp-actions' },
            h('button', {
              type: 'button',
              className: 'dsh-gp-button dsh-gp-button-primary',
              disabled: busy || phase === 'loading' || !dirty,
              onClick: () => persist(draft),
            }, busy ? t('saving') : t('save')),
            h('button', {
              type: 'button',
              className: 'dsh-gp-button',
              disabled: busy || phase === 'loading' || (prompt.trim() === '' && draft.trim() === ''),
              onClick: () => persist(''),
            }, t('clear')),
            notice !== null && phase === 'ready'
              ? h('span', {
                  key: 'notice',
                  className: notice.kind === 'error' ? 'dsh-gp-notice is-error' : 'dsh-gp-notice is-ok',
                  role: 'status',
                }, notice.text)
              : null,
          ),
        )

        return h('div', { className: 'dsh-gp' }, ...children)
      }
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => {
          const disposers = [
            ctx.locale.register(NS, 'en', LOCALE_DICTS.en),
            ctx.locale.register(NS, 'zh', LOCALE_DICTS.zh),
          ]
          return () => {
            for (const dispose of disposers) dispose()
          }
        }, 'global-prompt: locale dictionaries')

        const Page = createPage(ctx)
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'global-prompt',
          order: 25,
          label: () => t('nav'),
        }, Page))
      },
    }
  },
})
