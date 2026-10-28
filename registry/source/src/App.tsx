import { SettingsPage } from "./settings/page"
import app from "../alwith.app.json"
import { onDesktopNewChat } from "@alwith/module-desktop-shell/native"
import { ConversationView } from "@alwith/module-chat/conversation"
import { type SessionSummary, SessionListProvider } from "@alwith/module-chat/session-list"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { useChatHost } from "./chat-host"
import { client, useClient, useSession, watchRunStates } from "./client"
import { Leading } from "./layout/leading"
import { Navigation } from "./layout/navigation"
import { Shell } from "./layout/shell"

/** The session shown when the webview comes back; the Runtime keeps it alive across reloads. */
const SESSION_KEY = `${app.identifier}.session`

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => console.error("[window error]", event.message, event.error?.stack))
  window.addEventListener("unhandledrejection", (event) =>
    console.error("[unhandled rejection]", (event.reason as Error)?.message, (event.reason as Error)?.stack)
  )
}

// Connect once per webview (StrictMode runs effects twice; the client itself is idempotent): hold
// the agent, list what Codex has, then show the remembered session or start a new one.
let booting: Promise<string> | null = null
function boot(): Promise<string> {
  booting ??= (async () => {
    await client.connect()
    void watchRunStates().catch((error: unknown) => console.warn("run states unavailable", error))
    await client.listSessions().catch((error: unknown) => console.warn("session list unavailable", error))
    const remembered = sessionStorage.getItem(SESSION_KEY)
    const row = remembered ? client.state.sessionList.find((item) => item.sessionId === remembered) : undefined
    if (remembered && (row || client.state.runStates[remembered])) {
      try {
        await client.open(remembered, row?.cwd ?? client.state.runStates[remembered]?.cwd ?? ((await client.refreshProjectContext(true)).chatDirectory))
        return remembered
      } catch (error) {
        console.warn("reopening the remembered session failed, starting a new one", error)
      }
    }
    return client.newSession()
  })().catch((error: unknown) => {
    booting = null
    throw error
  })
  return booting
}

export function App() {
  const { t } = useTranslation()
  const connection = useClient((state) => state.connection)
  const connectionError = useClient((state) => state.connectionError)
  const [settings, setSettings] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const session = useSession(selected)
  const host = useChatHost(setError)

  const show = useCallback((id: string) => {
    sessionStorage.setItem(SESSION_KEY, id)
    setSelected(id)
    setSettings(false)
    setError(null)
  }, [])
  const report = (caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught))

  useEffect(() => {
    let cancelled = false
    boot().then(
      (id) => {
        if (!cancelled) show(id)
      },
      (caught: unknown) => {
        console.error("connect failed", caught)
        report(caught)
      }
    )
    return () => {
      cancelled = true
    }
  }, [show])

  async function newChat() {
    try {
      show(await client.newSession())
    } catch (caught) {
      report(caught)
    }
  }

  useEffect(() => {
    let disposed = false
    let stop: (() => void) | undefined
    void onDesktopNewChat(() => { void newChat() }).then((unlisten) => {
      if (disposed) unlisten()
      else stop = unlisten
    }).catch(report)
    return () => { disposed = true; stop?.() }
  }, [show])

  async function select(row: SessionSummary) {
    try {
      await client.open(row.sessionId, row.cwd)
      show(row.sessionId)
    } catch (caught) {
      report(caught)
    }
  }

  const status = connection === "ready" ? t("ready") : connection === "connecting" ? t("connecting") : connection
  const header = (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4" data-tauri-drag-region>
      <span className="truncate text-sm font-medium">{session ? (session.title ?? t("untitled")) : null}</span>
      <span className="ms-auto shrink-0 text-xs text-muted-foreground">{status}</span>
      {(error ?? connectionError) && <span className="truncate text-xs text-destructive">{error ?? connectionError}</span>}
    </header>
  )

  return (
    <SessionListProvider host={host} client={client}>
      <Shell
        leading={<Leading />}
        navigation={<Navigation selectedId={selected} onNew={() => void newChat()} onSelect={(row) => void select(row)} onSettings={() => setSettings(true)} />}
      >
        {settings ? <SettingsPage onClose={() => setSettings(false)} /> : session ? (
          <ConversationView key={session.id} session={session} client={client} host={host} header={header} />
        ) : (
          header
        )}
      </Shell>
    </SessionListProvider>
  )
}
