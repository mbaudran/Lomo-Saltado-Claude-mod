import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { wokPixels } from '../hooks/wok'
import { FRESH, compactCount, contextBar, describeTool, donenessOf, formatSpan, keloqzPid, kitchenRow, progressOf, shortModel, statusLine, stepsAfterUpdate } from '../hooks/cook'

const BAND = {
  plugin: 'saltado',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: true,
    maxRows: 12,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 12 },
    view: {},
  },
  viewport: { columns: 105, rows: 40, isFullscreen: true },
} as const

const PANE = {
  plugin: 'saltado',
  component: 'Pane',
  requestId: 'saltado-cocina',
  props: {
    title: 'Cocina',
    isFocused: false,
    bodyColumns: 70,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
  viewport: { columns: 180, rows: 40, isFullscreen: true },
} as const

/** The engine beneath the plugin: each event saltado passes on is answered here. */
function kitchenFloor(on: On, env: Record<string, string> = {}) {
  mock.clock(on, { now: 1_760_000_000_000 })
  mock.env(on, env)
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.panes', () => ({ value: [] }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', ($, e) =>
    e.tool === 'TaskCreate' ? { result: { task: { id: '7', subject: e.subject } } } : { result: {} },
  )
}

const TODOS = [
  { content: 'Read the hooks', status: 'completed', activeForm: 'Reading the hooks' },
  { content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' },
  { content: 'Ship it', status: 'pending', activeForm: 'Shipping it' },
] as const

describe('the band above the prompt', () => {
  test('names the terminal before anything is in the wok', async ($, on) => {
    kitchenFloor(on)
    await $.session.start({ cwd: '/work/marshall', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: 'marshall' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /listo para saltear/ })).toBeDefined()
    await ui.unmount()
  })

  test('shows the plan as a real share, the step and the wok', async ($, on) => {
    kitchenFloor(on)
    await $.session.start({ cwd: '/work/marshall', surface: 'terminal', isInteractive: true })
    await $.turn.start({ text: 'convierte cooked en un lomo saltado', turnId: 't1' })
    await $.tool.call({ tool: 'TodoWrite', todos: [...TODOS] })
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...BAND, surface })
      expect(await ui.find({ type: 'Text', text: '1/3' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /Writing tests/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /convierte cooked en un lomo saltado/ })).toBeDefined()
      if (surface === 'terminal') expect(await ui.find({ type: 'Raster', key: 'wok' })).toBeDefined()
      await ui.unmount()
    }
  })

  test('follows TaskCreate and TaskUpdate', async ($, on) => {
    kitchenFloor(on)
    await $.session.start({ cwd: '/work/marshall', surface: 'terminal', isInteractive: true })
    await $.turn.start({ text: 'plan it', turnId: 't1' })
    await $.tool.call({ tool: 'TaskCreate', subject: 'Draw the wok', description: 'pixels', activeForm: 'Drawing the wok' })
    await $.tool.call({ tool: 'TaskUpdate', taskId: '7', status: 'in_progress' })
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: '0/1' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Drawing the wok/ })).toBeDefined()
    await ui.unmount()
  })

  test('says what the last tool did when there is no plan', async ($, on) => {
    kitchenFloor(on)
    await $.session.start({ cwd: '/work/marshall', surface: 'terminal', isInteractive: true })
    await $.turn.start({ text: 'run the tests', turnId: 't1' })
    await $.tool.call({ tool: 'Bash', command: 'npm test', description: 'Run the test suite' })
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /\$ Run the test suite/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /1 op/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /sin lista de tareas/ })).toBeDefined()
    await ui.unmount()
  })

  test('reports the finished turn', async ($, on) => {
    kitchenFloor(on)
    await $.session.start({ cwd: '/work/marshall', surface: 'terminal', isInteractive: true })
    await $.turn.start({ text: 'quick one', turnId: 't1' })
    await $.tool.call({ tool: 'Read', file_path: '/work/marshall/README.md' })
    await $.turn.complete({ answer: 'done', durationMs: 4000, isAborted: false, turnId: 't1', reason: 'answer' })
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /servido en/ })).toBeDefined()
    await ui.unmount()
  })

  test('draws the session line at its foot, in the theme blue', async ($, on) => {
    kitchenFloor(on)
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('session.usage', () => ({
      value: { startedAt: 1_760_000_000_000 - 65 * 60_000, context: { window: 200_000, percent: 34 }, rateLimits: [{ kind: 'five_hour', percentUsed: 42 }] },
    }))
    await $.session.start({ cwd: '/work/marshall', surface: 'terminal', isInteractive: true })
    await $.turn.start({ text: 'read things', turnId: 't1' })
    await $.tool.call({ tool: 'Bash', command: 'ls' })
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const line = await ui.find({ type: 'Text', text: /contexto ███░░░░░░░ 34% · sesión 1h 05m · límite 5h 42%/ })
    expect(line).toBeDefined()
    expect(line?.props).toMatchObject({ color: 'permission' })
    await ui.unmount()
  })

  test('/saltado nombre renames this terminal', async ($, on) => {
    kitchenFloor(on)
    await $.session.start({ cwd: '/work/marshall', surface: 'terminal', isInteractive: true })
    const ran = await $.command.run({
      command: 'saltado',
      args: 'nombre front-end',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 120 },
    })
    expect(ran.text).toBe('Esta terminal ahora se llama "front-end".')
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: 'front-end' })).toBeDefined()
    await ui.unmount()
  })
})

describe('the cocina pane', () => {
  test('lists this terminal with its bar', async ($, on) => {
    kitchenFloor(on)
    await $.session.start({ cwd: '/work/marshall', surface: 'terminal', isInteractive: true })
    await $.turn.start({ text: 'cook something', turnId: 't1' })
    await $.tool.call({ tool: 'TodoWrite', todos: [...TODOS] })
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...PANE, surface })
      expect(await ui.find({ type: 'Text', text: 'Cocina' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /1 terminal · 1 saltando/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /esta terminal/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /1\/3/ })).toBeDefined()
      await ui.unmount()
    }
  })
})

describe('the words', () => {
  test('describe tool calls briefly', () => {
    expect(describeTool({ tool: 'Edit', file_path: '/a/b/register.tsx' })).toBe('editando register.tsx')
    expect(describeTool({ tool: 'mcp__github__create_issue' })).toBe('github · create_issue')
    expect(describeTool({ tool: 'Agent', description: 'Explore the repo' })).toBe('mandando a un ayudante: Explore the repo')
  })

  test('a deleted task leaves the plan', () => {
    const steps = [
      { id: '1', content: 'a', status: 'completed' as const },
      { id: '2', content: 'b', status: 'pending' as const },
    ]
    expect(stepsAfterUpdate(steps, { tool: 'TaskUpdate', taskId: '2', status: 'deleted' })).toEqual([steps[0]])
    expect(progressOf(steps)).toEqual({ done: 1, total: 2, step: '' })
  })

  test('the status line says model, context, tokens, session time and limits', () => {
    expect(shortModel('claude-opus-5-5')).toBe('opus 5.5')
    expect(compactCount(950)).toBe('950')
    expect(compactCount(1_240)).toBe('1.2k')
    expect(compactCount(84_400)).toBe('84k')
    expect(compactCount(1_240_000)).toBe('1.2M')
    expect(formatSpan(30_000)).toBe('<1m')
    expect(contextBar(86)).toBe('█████████░ 86% casi lleno')
    expect(formatSpan(65 * 60_000)).toBe('1h 05m')
    const base = { model: 'claude-opus-5-5', contextPercent: 34.4, tokensIn: 1_240_000, tokensOut: 84_000, sessionMs: 65 * 60_000 }
    expect(statusLine({ ...base, limits: [{ kind: 'five_hour', percentUsed: 42 }], costUsd: 3.1 })).toBe(
      'opus 5.5 · contexto ███░░░░░░░ 34% · ↑1.2M ↓84k tokens · sesión 1h 05m · límite 5h 42%',
    )
    expect(statusLine({ ...base, tokensIn: 0, tokensOut: 0, limits: [], costUsd: 3.1 })).toBe(
      'opus 5.5 · contexto ███░░░░░░░ 34% · sesión 1h 05m · $3.10',
    )
  })

  test('the wok never finishes before the turn does', () => {
    const none = { done: 0, total: 0, step: '' }
    expect(donenessOf('cooking', none, 60 * 60 * 1000)).toBeLessThan(0.91)
    expect(donenessOf('cooking', { done: 3, total: 3, step: '' }, 0)).toBeLessThan(1)
    expect(donenessOf('cooked', none, 0)).toBe(1)
  })
})

describe('the wok', () => {
  test('the beef goes in first, the cilantro only once served', () => {
    const colours = (doneness: number, isCooking: boolean) =>
      new Set(wokPixels(32, 20, { doneness, frame: 7, isCooking }))
    expect(colours(0, true).has(0x5cc84a)).toBe(false)
    expect(colours(1, false).has(0x5cc84a)).toBe(true)
  })

  test('flares into a flambé every few seconds', () => {
    const flames = (frame: number) => [...wokPixels(32, 20, { doneness: 0.5, frame, isCooking: true })].filter(c => c === 0xffe04a).length
    expect(flames(1)).toBeGreaterThan(flames(7))
  })
})

describe('handing off to Keloqz', () => {
  const beat = (fields: Record<string, unknown>) => JSON.stringify({ pid: 42, updatedAt: 1000, muted: false, sessions: ['s1'], ...fields })

  test('fresh heartbeat listing this session returns the pid', () => {
    expect(keloqzPid(beat({}), 20_000, 's1')).toBe(42)
  })

  test('a session Keloqz does not list keeps its banner', () => {
    expect(keloqzPid(beat({ sessions: ['other'] }), 20_000, 's1')).toBeUndefined()
    expect(keloqzPid(beat({ sessions: undefined }), 20_000, 's1')).toBeUndefined()
  })

  test('stale heartbeat returns undefined', () => {
    expect(keloqzPid(beat({}), 31_000, 's1')).toBeUndefined()
  })

  test('muted Keloqz silences every session', () => {
    expect(keloqzPid(beat({ muted: true, sessions: [] }), 2_000, 's1')).toBe(42)
  })

  test('missing or broken file returns undefined', () => {
    expect(keloqzPid(undefined, 2_000, 's1')).toBeUndefined()
    expect(keloqzPid('', 2_000, 's1')).toBeUndefined()
    expect(keloqzPid('{"pid":', 2_000, 's1')).toBeUndefined()
    expect(keloqzPid(beat({ pid: '42' }), 2_000, 's1')).toBeUndefined()
  })

  test('the kitchen row says whether the turn was aborted', () => {
    const meta = { sessionId: 's', name: 'n', cwd: '/w', now: 1 }
    expect(kitchenRow({ ...FRESH, isAborted: true }, meta).aborted).toBe(true)
    expect(kitchenRow(FRESH, meta).aborted).toBe(false)
  })
})

describe('the finish banner with Keloqz around', () => {
  const NOW = 1_760_000_000_000
  const ran = (stdout: string, exitCode = 0) => ({ exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false })

  /** A Mac with osascript, this session `sess-1`, and Keloqz's heartbeat as given. */
  function macWithKeloqz(on: On, heartbeat: string | undefined, isKeloqzAlive = true) {
    kitchenFloor(on, { HOME: '/Users/t' })
    const commands: string[][] = []
    on('session.id', () => ({ value: 'sess-1' }))
    on('process.run', ($, e) => {
      commands.push([...e.argv])
      if (e.argv[0] === 'uname') return { value: ran('Darwin\n') }
      if (e.argv[0] === 'date') return { value: ran('+0200\n') }
      if (e.argv[0] === 'kill') return { value: ran('', isKeloqzAlive ? 0 : 1) }
      if (e.argv.includes('command -v "$1"')) return { value: ran('', 1) }
      return { value: ran('') }
    })
    on('fs.read', ($, e) =>
      e.path === '/Users/t/.claude/saltado/keloqz.json' && heartbeat !== undefined ? { value: heartbeat } : { deny: 'no such file' },
    )
    return () => commands.some(argv => argv.includes('osascript'))
  }

  async function finishATurn($: Parameters<Parameters<typeof test>[1]>[0]) {
    await $.session.start({ cwd: '/work/marshall', surface: 'terminal', isInteractive: true })
    await $.turn.start({ text: 'quick one', turnId: 't1' })
    await $.turn.complete({ answer: 'done', durationMs: 4000, isAborted: false, turnId: 't1', reason: 'answer' })
    for (let i = 0; i < 50; i++) await new Promise(resolve => setTimeout(resolve, 0))
  }

  const fresh = (fields: Record<string, unknown> = {}) =>
    JSON.stringify({ pid: 4242, updatedAt: NOW - 5_000, muted: false, sessions: ['sess-1'], ...fields })

  test('no Keloqz: the banner goes out', async ($, on) => {
    const bannerSent = macWithKeloqz(on, undefined)
    await finishATurn($)
    expect(bannerSent()).toBe(true)
  })

  test('Keloqz covering this session: no banner', async ($, on) => {
    const bannerSent = macWithKeloqz(on, fresh())
    await finishATurn($)
    expect(bannerSent()).toBe(false)
  })

  test('Keloqz not covering this session: the banner goes out', async ($, on) => {
    const bannerSent = macWithKeloqz(on, fresh({ sessions: ['another'] }))
    await finishATurn($)
    expect(bannerSent()).toBe(true)
  })

  test('stale heartbeat: the banner goes out', async ($, on) => {
    const bannerSent = macWithKeloqz(on, fresh({ updatedAt: NOW - 31_000 }))
    await finishATurn($)
    expect(bannerSent()).toBe(true)
  })

  test('Keloqz crashed (pid gone): the banner goes out', async ($, on) => {
    const bannerSent = macWithKeloqz(on, fresh(), false)
    await finishATurn($)
    expect(bannerSent()).toBe(true)
  })

  test('Keloqz muted: no banner', async ($, on) => {
    const bannerSent = macWithKeloqz(on, fresh({ muted: true, sessions: [] }))
    await finishATurn($)
    expect(bannerSent()).toBe(false)
  })
})
