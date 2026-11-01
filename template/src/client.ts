import { observeRunStates } from "@alwith/api"
// The app-wide Codex client and its React bindings. Everything about holding the agent, routing
// updates by session, replaying on open, prompting with a receipt and answering permissions lives in
// `@alwith/module-chat/client`; API supplies Runtime transport and state observation.
import type { Session } from "@alwith/module-chat/client";
import { CodexClient, type CodexClientState } from "@alwith/module-chat/client"
import { useStore } from "zustand"

import app from "../alwith.app.json"
import { CODEX_AGENT_ID, runtimePort } from "./runtime"

export const client = new CodexClient(() => Promise.resolve(runtimePort()), {
  agentId: CODEX_AGENT_ID,
  launch: { engine: "codex" },
  info: { name: app.name, version: app.version }
})

export function useClient<T>(selector: (state: CodexClientState) => T): T {
  return useStore(client.store, selector)
}

export function useSession(id: string | null): Session | null {
  return useStore(client.store, (state) => (id === null ? null : (state.sessions[id] ?? null)))
}

/** Mirrors the Runtime's run states into the client store for the lifetime of the app. */
export async function watchRunStates(): Promise<() => void> {
  const port = runtimePort()
  const watcher = observeRunStates(port, (sessions, source) => client.applyRunStates(sessions, source === "snapshot" ? "snapshot" : undefined))
  await watcher.ready
  return watcher.dispose
}
