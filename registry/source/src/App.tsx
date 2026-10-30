import { DesktopHeader } from "@alwith/module-desktop-shell/react"
import {PetCenter, PetLounge} from "@alwith/module-auth/pets/react"
import {initializeVibemonMain, updateMainPetSurface, requestPet} from "./auth/pets"
import { openDesktopSettings } from "@alwith/module-desktop-shell/native"
import app from "../alwith.app.json"
import { onDesktopNewChat } from "@alwith/module-desktop-shell/native"
import { ConversationView } from "@alwith/module-chat/conversation"
import { type SessionSummary, SessionListProvider } from "@alwith/module-chat/session-list"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { useChatHost } from "./chat-host"
import { client, useClient, useSession, watchRunStates } from "./client"
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
    const cwd = remembered ? (row?.cwd ?? client.state.runStates[remembered]?.cwd) : undefined
    if (remembered && cwd) {
      try {
        await client.open(remembered, cwd)
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
  const [region, setRegion] = useState("workspace")
  const [petsReady, setPetsReady] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const session = useSession(selected)
  const host = useChatHost(setError)

  const show = useCallback((id: string) => {
    sessionStorage.setItem(SESSION_KEY, id)
    setSelected(id)
    setRegion("workspace")
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

  useEffect(() => {
    let active = true
    const onOpen = (event: Event) => {
      const id = (event as CustomEvent<string | null>).detail
      if (id === null) void newChat()
      else {
        const row = client.state.sessionList.find(row => row.sessionId === id)
        if (row) void select(row)
        else if (client.state.sessions[id]) show(id)
        else report(new Error("Conversation unavailable"))
      }
    }
    const onError = (event: Event) => report((event as CustomEvent).detail)
    window.addEventListener("pet:open-chat", onOpen)
    window.addEventListener("pet:error", onError)
    void initializeVibemonMain().then(() => { if (active) setPetsReady(true) }).catch(report)
    return () => { active = false; window.removeEventListener("pet:open-chat", onOpen); window.removeEventListener("pet:error", onError) }
  }, [show])
  useEffect(() => {
    if (petsReady) void updateMainPetSurface(selected, region === "workspace").catch(report)
  }, [petsReady, selected, region])

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
  const header = <DesktopHeader title={session ? (session.title ?? t("untitled")) : null} status={status} error={error ?? connectionError} />

  return (
    <SessionListProvider host={host} client={client}>
      <Shell
        leading={petsReady && <PetCenter />}
        region={region}
        onRegionChange={(region) => setRegion(region ?? "workspace")}
        trailing={petsReady && <PetLounge active={region === "trailing"} onOpenCenter={() => setRegion("leading")} onSend={async (petId, dropCenter) => { await requestPet("open-from-lounge", {petId, dropCenter}) }} />}
        navigation={<Navigation selectedId={selected} onNew={() => void newChat()} onSelect={(row) => void select(row)} onSettings={() => { void openDesktopSettings(t("settings")).catch(report) }} onPets={() => setRegion("leading")} petsReady={petsReady} />}
      >
        {session ? (
          <ConversationView key={session.id} session={session} client={client} host={host} header={header} />
        ) : (
          header
        )}
      </Shell>
    </SessionListProvider>
  )
}
