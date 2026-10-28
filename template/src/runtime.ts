// The Runtime port for this app: Rust spawns alwith-runtime over stdio, the webview talks frames
// through Tauri commands and events (`@alwith/api/tauri`). Launch shape per the Runtime's launcher.
import { TauriRuntimeClient } from "@alwith/api/tauri"

export type CodexLaunch = { engine: "codex"; cwd?: string; env?: Record<string, string> }
export const CODEX_AGENT_ID = "codex"

let port: TauriRuntimeClient<CodexLaunch> | null = null

export function runtimePort(): TauriRuntimeClient<CodexLaunch> {
  port ??= new TauriRuntimeClient<CodexLaunch>()
  return port
}

export function resetRuntimePort(): void {
  const stale = port
  port = null
  stale?.close()
}
