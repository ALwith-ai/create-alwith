import { afterEach, expect, mock, test } from "bun:test"

// Mock only the native boundary. Import the application's real wiring and public packages.
// No Runtime, engine process, filesystem state or credentials are opened by this suite.
type Frame = { id: number; method: string; params?: Record<string, unknown> }
const handlers = new Map<string, Set<(event: { payload: any }) => void>>()
const calls: Array<{ command: string; args: any }> = []
const frames: Frame[] = []
const stores = new Map<string, Record<string, unknown>>()
let respond: (frame: Frame) => unknown = () => null
let failure: string | null = null
function emit(event: string, payload: unknown) {
  for (const handler of handlers.get(event) ?? []) handler({ payload })
}
// The modules' generated commands import the whole event and core surface; only listen and invoke are exercised.
const unused = (name: string) => () => { throw new Error(`Unmocked native API: ${name}`) }
mock.module("@tauri-apps/api/event", () => ({
  listen: async (event: string, handler: (event: { payload: any }) => void) => {
    const listeners = handlers.get(event) ?? new Set()
    handlers.set(event, listeners); listeners.add(handler)
    return () => { listeners.delete(handler) }
  },
  once: unused("once"), emit: unused("emit"), emitTo: unused("emitTo")
}))
mock.module("@tauri-apps/api/core", () => ({
  Channel: class { constructor() { throw new Error("Unmocked native API: Channel") } },
  invoke: async (command: string, args: any) => {
    calls.push({ command, args })
    if (failure === command) throw new Error("fixture native failure")
    if (command === "runtime_start") return
    if (command === "runtime_send") {
      const frame = JSON.parse(args.line) as Frame
      frames.push(frame)
      const result = respond(frame)
      emit("runtime:lines", [JSON.stringify({ id: frame.id, connectionId: args.connectionId, result })])
      return
    }
    const key = `${args.scope}:${args.store}`
    const values = stores.get(key) ?? {}
    stores.set(key, values)
    switch (command) {
      case "plugin:alwith-store|store_entries": return { ...values }
      case "plugin:alwith-store|store_set":
        values[args.key] = args.value
        emit("store-changed", { store: args.store, key: args.key, value: args.value })
        return
      case "plugin:alwith-store|store_delete": delete values[args.key]; return
      case "plugin:alwith-store|store_reload": return
      default: throw new Error(`Unmocked native command: ${command}`)
    }
  }
}))
const { runtimePort, resetRuntimePort, CODEX_AGENT_ID } = await import("../src/runtime")
const { openStore } = await import("../src/store")
afterEach(() => {
  resetRuntimePort()
  handlers.clear(); calls.length = 0; frames.length = 0; stores.clear()
  failure = null; respond = () => null
})

test("one native connection is shared and reset disposes listeners before reopening", async () => {
  const first = runtimePort()
  expect(runtimePort()).toBe(first)
  await first.ping()
  await first.ping()
  expect(calls.filter(call => call.command === "runtime_start")).toHaveLength(1)
  resetRuntimePort()
  expect([...handlers.values()].every(set => set.size === 0)).toBe(true)
  await expect(first.ping()).rejects.toThrow("Runtime exited")
  const next = runtimePort()
  expect(next).not.toBe(first)
  await next.ping()
  const starts = calls.filter(call => call.command === "runtime_start")
  expect(starts).toHaveLength(2)
  expect(starts[0].args.connectionId).not.toBe(starts[1].args.connectionId)
})

test("chat creation, prompt, approval response and history use the app's Runtime connection", async () => {
  respond = frame => {
    if (frame.method === "sessionNew") return { sessionId: "fixture-session" }
    if (frame.method === "prompt") return { stopReason: "end_turn" }
    if (frame.method === "sessionEvents") return [{ sequence: 1, recordedAt: 1, direction: "in", line: "fixture history" }]
    return null
  }
  const port = runtimePort()
  const session = await port.sessionNew(CODEX_AGENT_ID, "/fixture/project")
  expect(session.sessionId).toBe("fixture-session")
  expect(await port.prompt(CODEX_AGENT_ID, session.sessionId, [{ type: "text", text: "fixture prompt" }])).toEqual({ stopReason: "end_turn" })
  const requests: unknown[] = []
  const unsubscribe = await port.onAcpAgentRequest(request => requests.push(request))
  emit("runtime:lines", [JSON.stringify({ type: "acpAgentRequest", agentId: CODEX_AGENT_ID, id: "approval-1", method: "session/request_permission", params: { sessionId: session.sessionId } })])
  expect(requests).toMatchObject([{ id: "approval-1", method: "session/request_permission" }])
  await port.acpRespond(CODEX_AGENT_ID, "approval-1", { outcome: { outcome: "selected", optionId: "allow-once" } })
  expect(frames.find(frame => frame.method === "acpRespond")?.params).toMatchObject({ agentId: CODEX_AGENT_ID, id: "approval-1", result: { outcome: { optionId: "allow-once" } } })
  expect(await port.sessionEvents(session.sessionId)).toMatchObject([{ line: "fixture history" }])
  expect(frames.find(frame => frame.method === "sessionNew")?.params).toMatchObject({ cwd: "/fixture/project", agentId: CODEX_AGENT_ID })
  unsubscribe()
})

test("native send failure is exposed without repeating the operation", async () => {
  failure = "runtime_send"
  await expect(runtimePort().prompt(CODEX_AGENT_ID, "fixture-session", [])).rejects.toThrow("fixture native failure")
  expect(calls.filter(call => call.command === "runtime_send")).toHaveLength(1)
})

test("native exit rejects pending calls and releases transport listeners", async () => {
  respond = () => { emit("runtime:exit", { code: 1, signal: null }); return null }
  await expect(runtimePort().ping()).rejects.toThrow("Runtime exited")
  expect([...handlers.values()].every(set => set.size === 0)).toBe(true)
})

test("settings round-trip through named storage and propagate cross-window changes", async () => {
  const settings = openStore("settings")
  const changes: unknown[] = []
  const unsubscribe = await settings.onKeyChange("acceptance.fixture", value => changes.push(value))
  await settings.set("acceptance.fixture", "dark")
  await settings.reload()
  expect(await settings.get("acceptance.fixture")).toBe("dark")
  emit("store-changed", { store: "another-store", key: "acceptance.fixture", value: "ignored" })
  emit("store-changed", { store: "settings", key: "acceptance.fixture", value: "light" })
  expect(changes).toEqual(["dark", "light"])
  unsubscribe()
  emit("store-changed", { store: "settings", key: "acceptance.fixture", value: "ignored" })
  expect(changes).toHaveLength(2)
  await settings.delete("acceptance.fixture")
  expect(await settings.has("acceptance.fixture")).toBe(false)
})

test("storage write errors reach the caller without a second write", async () => {
  failure = "plugin:alwith-store|store_set"
  await expect(openStore("settings").set("acceptance.fixture", true)).rejects.toThrow("fixture native failure")
  expect(calls.filter(call => call.command === failure)).toHaveLength(1)
})

test("application run-state subscription delivers snapshots and events, then disposes", async () => {
  const { client, watchRunStates } = await import("../src/client")
  const state = {
    sessionId: "fixture-activity", state: "running", reusableDraft: false,
    owner: CODEX_AGENT_ID, cwd: "/fixture/project", title: "Fixture", since: 1,
    tasks: [], listeningPorts: [], executionId: null, executionRole: null,
    lastActivityAt: 1, version: 1, interruption: null
  }
  respond = frame => frame.method === "runStates" ? [state] : null
  const dispose = await watchRunStates()
  try {
    expect(client.state.runStates[state.sessionId]?.state).toBe("running")
    emit("runtime:lines", [JSON.stringify({ type: "runStates", sessions: [{ ...state, state: "requires_action", version: 2 }] })])
    expect(client.state.runStates[state.sessionId]?.state).toBe("requires_action")
    dispose()
    emit("runtime:lines", [JSON.stringify({ type: "runStates", sessions: [{ ...state, state: "done", version: 3 }] })])
    expect(client.state.runStates[state.sessionId]?.state).toBe("requires_action")
  } finally { dispose() }
})
