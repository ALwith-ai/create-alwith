import { type DesktopScreen, DesktopHeader } from "@alwith/module-desktop-shell/react"
import {PetLounge} from "@alwith/module-auth/pets/react"
import {initializeVibemonMain, updateMainPetSurface, requestPet} from "./auth/pets"
import { openDesktopSettings } from "@alwith/module-desktop-shell/native"
import app from "../alwith.app.json"
import { onDesktopMenu, onDesktopNewChat } from "@alwith/module-desktop-shell/native"
import { ActionCard, Composer, ConnectionNotice, ConversationProvider, ConversationView, DraftProjectPicker, ElicitationForm, isFormAction } from "@alwith/module-chat/conversation"
import { applyProvidersWhenIdle, codexSettingsBridge, serveSettingsBridge } from "@alwith/module-chat/settings"
import { emitTo, listen } from "@tauri-apps/api/event"
import { CollectionHostProvider, CollectionProvider } from "@alwith/module-chat/collections"
import { type SessionSummary, SessionListProvider } from "@alwith/module-chat/session-list"
import { useCallback, useEffect, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { useTranslation } from "react-i18next"

import { useChatHost } from "./chat-host"
import { client, useClient, useSession, watchRunStates } from "./client"
import { collections } from "./collections"
import { providers } from "./providers"
import { LeadingScreen, type LeadingPage } from "./layout/leading"
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
    // Saved provider keys reach Codex before any model choice is restored; a failure shows in Settings, nothing repeats.
    await applyProvidersWhenIdle(providers).catch((error: unknown) => console.warn("provider application failed", error))
    void watchRunStates().catch((error: unknown) => console.warn("run states unavailable", error))
    await client.listSessions().catch((error: unknown) => console.warn("session list unavailable", error))
    const remembered = sessionStorage.getItem(SESSION_KEY)
    const row = remembered ? client.state.sessionList.find((item) => item.sessionId === remembered) : undefined
    const running = remembered ? client.state.runStates[remembered] : undefined
    // A remembered draft never carried a message: it cannot be reopened, so it goes and a new one starts.
    if (remembered && running?.reusableDraft) {
      await client.delete(remembered).catch((error: unknown) => console.warn("discarding the remembered draft failed", error))
    } else if (remembered && (row?.cwd ?? running?.cwd)) {
      try {
        await client.open(remembered, row?.cwd ?? running!.cwd)
        return remembered
      } catch (error) {
        console.warn("reopening the remembered session failed, starting a new one", error)
      }
    }
    return client.newSession(undefined, { draft: true })
  })().catch((error: unknown) => {
    booting = null
    throw error
  })
  return booting
}
/** After a failed or dropped connection: connect again and show the remembered or a new session. */
function reboot(): Promise<string> {
  booting = null
  return boot()
}

export function App() {
  const { t } = useTranslation()
  const connection = useClient((state) => state.connection)
  const connectionError = useClient((state) => state.connectionError)
  const [screen, setScreen] = useState<DesktopScreen>("main")
  const [region, setRegion] = useState("chat")
  const [leadingPage, setLeadingPage] = useState<LeadingPage>("pets")
  const [petsReady, setPetsReady] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const session = useSession(selected)
  const host = useChatHost(setError)
  // Requests outside any conversation (a provider sign-in elicitation) render as cards above the chat, as in U.
  const globalActions = useClient(useShallow((state) => state.actions.filter((action) => action.sessionId === null)))
  const globalForms = globalActions.filter(isFormAction)
  const globalInlineActions = globalActions.filter((action) => !globalForms.some((form) => form.id === action.id))

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
    if (petsReady) void updateMainPetSurface(selected, region === "chat").catch(report)
  }, [petsReady, selected, region])

  // The settings window shows the Codex account and signs in or out through this window's connection.
  useEffect(() => serveSettingsBridge(codexSettingsBridge(client), { listen, emitTo }), [])

  // A new chat is a draft until its first message, as in U: it runs in the Runtime's quick-chat
  // directory or the chosen project, and an empty draft is discarded when another replaces it.
  async function newChat(cwd?: string, collectionId?: string) {
    try {
      const id = await client.newSession(cwd, { draft: true })
      show(id)
      // Started from a 收藏 group: the draft joins it right away, as in U.
      if (collectionId !== undefined) await collections.dispatch({ type: "add", collectionId, sessionId: id })
    } catch (caught) {
      report(caught)
    }
  }

  const draft = useClient((state) => (selected !== null ? state.drafts[selected] === true : false))
  async function changeProject(cwd: string | null) {
    const previous = selected
    await newChat(cwd ?? undefined)
    if (previous !== null && client.isDraft(previous)) await client.discardDraft(previous).catch(report)
  }

  // The native menu owns the shortcuts (New Chat ⌘N, Preferences ⌘,); the page answers its actions.
  useEffect(() => {
    let disposed = false
    const stops: (() => void)[] = []
    const subscribe = (listen: Promise<() => void>) =>
      listen.then((unlisten) => {
        if (disposed) unlisten()
        else stops.push(unlisten)
      }).catch(report)
    void subscribe(onDesktopNewChat(() => { void newChat() }))
    void subscribe(onDesktopMenu("settings", () => { void openDesktopSettings(t("settings")).catch(report) }))
    return () => { disposed = true; for (const stop of stops) stop() }
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
      <CollectionHostProvider host={{ emojibaseUrl: "/emojibase" }}>
      <CollectionProvider store={collections}>
      <Shell
        leading={<LeadingScreen page={leadingPage} onPageChange={setLeadingPage} petsReady={petsReady} cwd={session?.cwd ?? null} />}
        screen={screen}
        onScreenChange={setScreen}
        onRegionChange={setRegion}
        trailing={petsReady && <PetLounge active={region === "trailing"} onOpenCenter={() => setScreen("leading")} onSend={async (petId, dropCenter) => { await requestPet("open-from-lounge", {petId, dropCenter}) }} />}
        navigation={<Navigation selectedId={selected} screen={screen} onSwitchScreen={() => setScreen(screen === "main" ? "leading" : "main")} onNew={() => void newChat()} onNewInCollection={(collectionId) => void newChat(undefined, collectionId)} onSelect={(row) => void select(row)} onSettings={() => { void openDesktopSettings(t("settings")).catch(report) }} onPets={() => { setLeadingPage("pets"); setScreen("leading") }} onShowPet={() => { void requestPet("open-pet").then(result => { if (result === "unavailable") { setLeadingPage("pets"); setScreen("leading") } }).catch(report) }} petsReady={petsReady} />}
      >
        <div className="main-chat-surface flex min-h-0 flex-1 flex-col">
        <ConversationProvider host={host} client={client}>
          <ConnectionNotice connection={connection} error={connectionError} onReconnect={() => { reboot().then(show).catch(report) }} />
          {globalInlineActions.length > 0 && (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 pt-12">
              {globalInlineActions.map((action) => <ActionCard key={action.id} action={action} />)}
            </div>
          )}
          {globalForms[0] !== undefined && <ElicitationForm action={globalForms[0]} total={globalForms.length} />}
        </ConversationProvider>
        {session ? (
          <ConversationView
            key={session.id}
            session={session}
            client={client}
            host={host}
            header={header}
            composer={
              <Composer
                session={session}
                inputHeader={
                  draft ? <DraftProjectPicker cwd={session.cwd} onChange={(cwd) => void changeProject(cwd)} /> : undefined
                }
              />
            }
          />
        ) : (
          header
        )}
        </div>
      </Shell>
      </CollectionProvider>
      </CollectionHostProvider>
    </SessionListProvider>
  )
}
