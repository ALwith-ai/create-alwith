import appIcon from "@/generated/app-icon"
import { sessionGroup } from "@alwith/module-chat/client"
import { AddToCollectionAction, CollectionPanel, useDispatchCollection, useReportCollection } from "@alwith/module-chat/collections"
import {
  AccountLanguageMenu,
  AccountMenu,
  AccountMenuGroup,
  AccountMenuItem,
  ActivityList,
  HelpMenu,
  HoverInfoAction,
  MENU_HIGHLIGHT,
  NavigationHeader,
  NavigationItemButton,
  NavigationLeading,
  NavigationScreenSwitch,
  NavigationStack,
  NavigationTabs,
  SessionList,
  SessionListFilter,
  SessionRow,
  type SessionSummary,
  useActivityNotification,
  useNavigationView,
  useSessionListExpansion,
  useSessionListHost
} from "@alwith/module-chat/session-list"
import { openDesktopGuide } from "@alwith/module-desktop-shell/native"
import { DesktopNavigationFooter } from "@alwith/module-desktop-shell/react"
import { ActivityIcon, FolderIcon, FolderMinusIcon, LifeBuoyIcon, PawPrintIcon, PlusIcon, SettingsIcon, StarIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import app from "../../alwith.app.json"
import { logoutPlatform, usePlatformAuth } from "../auth/store"
import { useClient } from "../client"
import { changeLanguage, LANGUAGES } from "../i18n"

/** U's hover-card actions on a session row: 收藏, and inside a group, remove from it. */
function SessionRowActions({ sessionRow, collectionId }: { sessionRow: SessionSummary; collectionId?: string }) {
  const chat = useSessionListHost().t
  const dispatch = useDispatchCollection()
  const report = useReportCollection()
  return (
    <>
      <AddToCollectionAction sessionId={sessionRow.sessionId} allowRemove={collectionId === undefined} />
      {collectionId !== undefined && (
        <HoverInfoAction
          icon={<FolderMinusIcon />}
          label={chat("collection.removeFromGroup")}
          onClick={() => report(dispatch({ type: "remove", collectionId, sessionId: sessionRow.sessionId }))}
        />
      )}
    </>
  )
}

/** The persistent Atlas navigation column: U's header, Collections, Chats and Activity panels and account menu, from module-chat. */
export function Navigation({ selectedId, screen, onSwitchScreen, onNew, onNewInCollection, onSelect, onSettings, onPets, onShowPet, petsReady }: {
  selectedId: string | null
  screen: "main" | "leading"
  onSwitchScreen: () => void
  onNew: () => void
  onNewInCollection: (collectionId: string) => void
  onSelect: (row: SessionSummary) => void
  onPets: () => void
  petsReady: boolean
  onShowPet: () => void
  onSettings: () => void
}) {
  const { t, i18n } = useTranslation()
  const user = usePlatformAuth((state) => state.user)
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const expansion = useSessionListExpansion()
  // Chats or Activity, kept per client while the app runs; Activity's dot follows the Runtime's run states.
  const chat = useSessionListHost().t
  const [view, setView] = useNavigationView()
  const activityNotification = useActivityNotification(view)
  const tabs = [
    { key: "collections", title: chat("collection.title"), icon: <StarIcon /> },
    { key: "sessions", title: chat("sessionList.chats"), icon: <FolderIcon /> },
    { key: "activity", title: chat("sessionList.activity"), icon: <ActivityIcon /> }
  ]
  // Groups start closed; open the one holding the shown session once.
  const group = useClient((state) => {
    const row = state.sessionList.find((item) => item.sessionId === selectedId)
    return row && state.projectContext ? sessionGroup(state.projectContext, row).id : null
  })
  const { setOpen } = expansion
  const opened = useRef<string | null>(null)
  useEffect(() => {
    // Only when the shown session moves to another group; a reset (double-clicking Chats) stays closed.
    if (group === null || opened.current === group) return
    opened.current = group
    setOpen(group, true)
  }, [group, setOpen])

  return (
    <>
      <div className="desktop-shell-navigation-header">
        <NavigationHeader
          title={app.productName}
          actions={[{ key: "new", icon: <PlusIcon />, label: t("newChat"), shortcut: "CmdOrCtrl+N", onClick: onNew }]}
        >
          {petsReady && (
            <NavigationItemButton className={`${MENU_HIGHLIGHT}`} onClick={onPets}>
              <NavigationLeading><PawPrintIcon /></NavigationLeading>
              <span>{t("pets")}</span>
            </NavigationItemButton>
          )}
        </NavigationHeader>
      </div>
      <NavigationTabs
        tabs={tabs}
        view={view}
        onViewChange={setView}
        onReset={(key) => key === "sessions" && expansion.reset?.()}
        trailing={view === "sessions" ? <SessionListFilter onCollapseAll={() => expansion.reset?.()} /> : undefined}
        notifications={activityNotification ? new Set(["activity"]) : undefined}
      />
      <div ref={setViewport} className="desktop-shell-navigation-list">
        <NavigationStack>
          {view === "collections" ? (
            <CollectionPanel
              renderRow={(sessionRow, onHoverCardOpenChange, collectionId) => (
                <SessionRow
                  key={sessionRow.sessionId}
                  sessionRow={sessionRow}
                  active={sessionRow.sessionId === selectedId}
                  onSelect={onSelect}
                  onHoverCardOpenChange={onHoverCardOpenChange}
                  actions={<SessionRowActions sessionRow={sessionRow} collectionId={collectionId} />}
                />
              )}
              onSelect={onSelect}
              onNewChat={onNewInCollection}
            />
          ) : view === "activity" ? (
            <ActivityList selectedId={selectedId} onSelect={onSelect} rowActions={(row) => <SessionRowActions sessionRow={row} />} />
          ) : (
            <SessionList selectedId={selectedId} onSelect={onSelect} viewport={viewport} expansion={expansion} rowActions={(row) => <SessionRowActions sessionRow={row} />} />
          )}
        </NavigationStack>
      </div>
      <DesktopNavigationFooter>
        <NavigationScreenSwitch screen={screen} onSwitch={onSwitchScreen} />
        <div data-sidebar-footer-row className="flex h-[var(--navigation-row-height)] items-center gap-0.5">
          <div className="min-w-0 flex-1">
            {user && (
              <AccountMenu
                // Without a platform avatar the account shows this app's icon.
                user={{ name: user.nickname || user.login_email, email: user.login_email, avatar: user.avatar || appIcon }}
                onSignOut={logoutPlatform}
              >
                <AccountMenuGroup>
                  <AccountMenuItem onClick={onSettings}>
                    <SettingsIcon />
                    {t("settings")}
                  </AccountMenuItem>
                  {petsReady && <AccountMenuItem onClick={onShowPet}><PawPrintIcon />{t("showDesktopPet")}</AccountMenuItem>}
                  <AccountLanguageMenu languages={LANGUAGES} value={i18n.language} onChange={changeLanguage} />
                </AccountMenuGroup>
              </AccountMenu>
            )}
          </div>
          <HelpMenu>
            <AccountMenuItem onClick={() => void openDesktopGuide(t("userGuide")).catch(console.error)}>
              <LifeBuoyIcon />
              {t("userGuide")}
            </AccountMenuItem>
          </HelpMenu>
        </div>
      </DesktopNavigationFooter>
    </>
  )
}
