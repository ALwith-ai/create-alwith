import appIcon from "@/generated/app-icon"
import { sessionGroup } from "@nyssance/codex-acp-v2/client"
import {
  NavigationStack,
  SessionList,
  type SessionSummary,
  useSessionListExpansion
} from "@alwith/module-chat/session-list"
import { PawPrintIcon, LogOutIcon, MessageSquarePlusIcon, SettingsIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import app from "../../alwith.app.json"
import { logoutPlatform, usePlatformAuth } from "../auth/store"
import { useClient } from "../client"

/** The persistent Atlas navigation column: brand, new chat, module-chat's session list, settings. */
export function Navigation({ selectedId, onNew, onSelect, onSettings, onPets, petsReady }: {
  selectedId: string | null
  onNew: () => void
  onSelect: (row: SessionSummary) => void
  onPets: () => void
  petsReady: boolean
  onSettings: () => void
}) {
  const { t } = useTranslation()
  const email = usePlatformAuth((state) => state.user?.login_email)
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const expansion = useSessionListExpansion()
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
      <div className="desktop-shell-navigation-header"><div className="desktop-shell-brand" data-tauri-drag-region>
        <img src={appIcon} alt="" className="size-6 rounded-md" draggable={false} />
        <span className="font-semibold">{app.productName}</span>
      </div></div>
      <div className="desktop-shell-navigation-actions">
        <Button variant="outline" size="icon" className="shrink-0" aria-label={t("newChat")} onClick={onNew}>
          <MessageSquarePlusIcon />
        </Button>
        <Button variant="ghost" size="icon" disabled={!petsReady} onClick={onPets} aria-label={t("pets")}><PawPrintIcon /></Button>
      </div>
      <div ref={setViewport} className="desktop-shell-navigation-list">
        <NavigationStack>
          <SessionList selectedId={selectedId} onSelect={onSelect} viewport={viewport} expansion={expansion} />
        </NavigationStack>
      </div>
      <div className="desktop-shell-navigation-footer">
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
