/**
 * Global prompt — Host half.
 *
 * One user-authored prompt, stored in `$DSH_HOME/global-prompt.md`, is registered
 * as an early system-prompt section so every session (including the sessions of
 * subagents and teammates) loads it before its first model request. The same
 * plugin serves an authenticated read/write route for the Settings page owned by
 * the Client half, so the prompt can be edited without touching profile files.
 *
 * The plugin deliberately depends on nothing but Node builtins: an installed
 * bundle is linked from the workspace and must resolve all of its imports there.
 */
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** The Host row id / package identity of this plugin. */
export const name = 'global-prompt'

/** The prompt registry must exist before the section can be contributed. */
export const inject = ['systemPrompt']

/** Prompt file name under the harness home. */
const FILE_NAME = 'global-prompt.md'

/** Absolute, authenticated Fetch route the Settings page talks to. */
const ROUTE_PATH = '/api/global-prompt'

/** Largest accepted prompt, in UTF-8 bytes. */
const MAX_PROMPT_BYTES = 64 * 1024

/** Resolve the harness home the same way other Harness services do. */
function dshHome() {
  const configured = process.env.DSH_HOME
  if (typeof configured === 'string' && configured.length > 0) return configured
  return join(homedir(), '.dsh')
}

/** Absolute path of the durable prompt file. */
function promptPath() {
  return join(dshHome(), FILE_NAME)
}

let cachedPath
let cachedText = ''
let cachedMtime = -1

/**
 * Read the prompt file, reusing the last read until the file's mtime changes.
 * A missing or unreadable file is an empty prompt rather than an error: the
 * global prompt is optional.
 * @returns the current prompt text, or an empty string.
 */
function readPrompt() {
  const file = promptPath()
  try {
    const stat = statSync(file)
    if (file !== cachedPath || stat.mtimeMs !== cachedMtime) {
      cachedText = readFileSync(file, 'utf8')
      cachedMtime = stat.mtimeMs
      cachedPath = file
    }
    return cachedText
  } catch {
    cachedPath = file
    cachedMtime = -1
    cachedText = ''
    return ''
  }
}

/**
 * Atomically write the prompt file, then let the cached read observe it.
 * @param text - the complete prompt contents.
 */
function writePrompt(text) {
  const file = promptPath()
  mkdirSync(dshHome(), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  writeFileSync(temporary, text, 'utf8')
  renameSync(temporary, file)
  cachedPath = file
  cachedText = text
  try {
    cachedMtime = statSync(file).mtimeMs
  } catch {
    cachedMtime = -1
  }
}

/** A JSON response with no caching, so every Settings visit reads fresh state. */
function jsonResponse(status, value) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/**
 * Serve `GET` (read) and `POST` (replace) for the Settings page.
 * @param request - the authenticated Request that Connection admitted.
 * @returns the JSON response.
 */
async function handleRoute(request) {
  if (request.method === 'GET') {
    return jsonResponse(200, { ok: true, prompt: readPrompt() })
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'method not allowed' })
  }
  let body
  try {
    body = await request.json()
  } catch {
    return jsonResponse(400, { ok: false, error: 'expected a JSON body' })
  }
  const prompt = body?.prompt
  if (typeof prompt !== 'string') {
    return jsonResponse(400, { ok: false, error: 'prompt must be a string' })
  }
  if (Buffer.byteLength(prompt, 'utf8') > MAX_PROMPT_BYTES) {
    return jsonResponse(413, { ok: false, error: 'prompt is too long' })
  }
  try {
    writePrompt(prompt)
  } catch {
    return jsonResponse(500, { ok: false, error: 'failed to write the global prompt file' })
  }
  return jsonResponse(200, { ok: true, prompt })
}

/**
 * Contribute the prompt section and, in a Web composition, the Settings route.
 * @param ctx - the Host plugin context.
 */
export function apply(ctx) {
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'global-prompt:user',
    order: 100,
    // Read on every assembly so edits apply to open sessions' next request.
    text: () => {
      const prompt = readPrompt()
      return prompt.trim().length > 0 ? prompt : ''
    },
    // The prompt is literal user prose: `{{...}}` must never be interpolated.
    interpolate: false,
  }), 'global-prompt: system prompt section')

  // Optional Web carrier: a headless composition keeps the prompt but has no
  // Settings page and therefore no route.
  ctx.inject(['connection'], (child) => {
    child.effect(() => child.connection.fetch.register({
      path: ROUTE_PATH,
      methods: ['GET', 'POST'],
      requestBody: 'buffered',
      fetch: handleRoute,
    }), 'global-prompt: settings route')
  })
}

/** Test-visible internals; not part of the plugin contract. */
export const internals = {
  dshHome,
  promptPath,
  readPrompt,
  writePrompt,
  handleRoute,
  MAX_PROMPT_BYTES,
  ROUTE_PATH,
}
