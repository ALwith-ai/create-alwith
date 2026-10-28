import appIcon from "@/generated/app-icon"
import { sessionGroup } from "@nyssance/codex-acp-v2/client"
import {
  NavigationStack,
  SessionList,
  SessionStateMenu,
  type SessionSummary,
  useSessionListExpansion
} from "@alwith/module-chat/session-list"
import { LogOutIcon, MessageSquarePlusIcon, SettingsIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import app from "../../alwith.app.json"
import { logoutPlatform, usePlatformAuth } from "../auth/store"
import { useClient } from "../client"

/** The persistent Atlas navigation column: brand, new chat, module-chat's session list, settings. */
export function Navigation({ selectedId, onNew, onSelect, onSettings }: {
  selectedId: string | null
  onNew: () => void
  onSelect: (row: SessionSummary) => void
  onSettings: () => void
}) {
  const { t } = useTranslation()
  const email = usePlatformAuth((state) => state.user?.login_email)
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const expansion = useSessionListExpansion()
  const runStates = useClient((state) => state.runStates)
  const sessionRows = useClient((state) => state.sessionList)
  // Groups start closed; open the one holding the shown session once.
  const group = useClient((state) => {
    const row = state.sessionList.find((item) => item.sessionId === selectedId)
    return row && state.projectContext ? sessionGroup(state.projectContext, row).id : null
  })
  const { open, setOpen } = expansion
  useEffect(() => {
    if (group !== null && !open.has(group)) setOpen(group, true)
  }, [group, open, setOpen])

  return (
    <>
      <div className="flex h-12 shrink-0 items-center gap-2 px-4" data-tauri-drag-region>
        <img src={appIcon} alt="" className="size-6 rounded-md" draggable={false} />
        <span className="font-semibold">{app.productName}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto px-3">
        <Button variant="outline" className="min-w-0 flex-1 justify-start gap-2" onClick={onNew}>
          <MessageSquarePlusIcon />
          {t("newChat")}
        </Button>
        <SessionStateMenu
          sessions={Object.values(runStates).filter((record) => !record.reusableDraft)}
          t={t}
          onSelect={(record) => onSelect(sessionRows.find((row) => row.sessionId === record.sessionId) ?? {
            sessionId: record.sessionId, cwd: record.cwd, title: record.title || null, updatedAt: null, archived: false
          })}
        />
      </div>
      <div ref={setViewport} className="mt-3 min-h-0 flex-1 overflow-y-auto px-2">
        <NavigationStack>
          <SessionList selectedId={selectedId} onSelect={onSelect} viewport={viewport} expansion={expansion} />
        </NavigationStack>
      </div>
      <div className="shrink-0 border-t border-sidebar-border p-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" className="min-w-0 flex-1 justify-start gap-2" onClick={onSettings}>
            <SettingsIcon />
            <span className="truncate">{email ?? t("settings")}</span>
          </Button>
          <Button variant="ghost" size="icon" title={t("signOut")} onClick={() => void logoutPlatform()}>
            <LogOutIcon />
          </Button>
        </div>
      </div>
    </>
  )
}
