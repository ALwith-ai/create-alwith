import { PetCenter } from "@alwith/module-auth/pets/react"
import { ArchivedSessions, useSessionListHost } from "@alwith/module-chat/session-list"
import { Pane, PluginsPage, PluginsProvider, toolboxContentClassName } from "@alwith/module-chat/plugins"
import { DesktopLeading, LeadingNavigation, type LeadingNavigationItem } from "@alwith/module-desktop-shell/react"
import { ExtensionNavigation, ExtensionPage, ExtensionsHostProvider, ExtensionsSection, useExtensions } from "@alwith/module-extension/react"
import { pickLocalExtension } from "@alwith/module-extension/tauri"
import { ask } from "@tauri-apps/plugin-dialog"
import { ArchiveIcon, LayoutGridIcon, PawPrintIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { usePluginsHost } from "../chat-host"
import { client } from "../client"
import { extensions } from "../extensions"
import "@alwith/module-chat/plugins.css"

export type LeadingPage = "pets" | "plugins" | "extensions" | "archives"

/** The screen to the left of the chat: U's rail (pets, toolbox, archives, installed extensions), then the page it selected. */
export function LeadingScreen({ page, onPageChange, petsReady, cwd }: {
  page: LeadingPage
  onPageChange: (page: LeadingPage) => void
  petsReady: boolean
  /** The shown conversation's project; the toolbox lists that project's skills. */
  cwd: string | null
}) {
  const { t, i18n } = useTranslation()
  const host = useSessionListHost()
  const chat = host.t
  const pluginsHost = usePluginsHost()
  const reportError = (error: unknown) => host.reportError?.(error)
  // The extension runtime belongs to the webview; this screen mirrors its state and starts it once.
  const ext = useExtensions(extensions.getRuntime(), extensions.start, reportError)
  const [extensionView, setExtensionView] = useState<string | null>(null)
  const [toolboxVisited, setToolboxVisited] = useState(false)
  const openToolbox = (next: "plugins" | "extensions") => {
    setToolboxVisited(true)
    setExtensionView(null)
    onPageChange(next)
  }
  const openExtension = (id: string) => {
    setExtensionView(id)
    onPageChange("extensions")
  }
  const items: LeadingNavigationItem[] = [
    { id: "pets", label: t("pets"), icon: PawPrintIcon, onClick: () => onPageChange("pets") },
    { id: "plugins", label: chat("plugins.catalog.customize"), icon: LayoutGridIcon, onClick: () => openToolbox("plugins") },
    { id: "archives", label: chat("sessionList.archives.title"), icon: ArchiveIcon, onClick: () => onPageChange("archives") }
  ]
  const toolbox = page === "plugins" || page === "extensions"
  const navigation = (
    <LeadingNavigation
      label={t("leadingNavigation")}
      items={items}
      activePage={extensionView !== null ? null : page === "extensions" ? "plugins" : page}
    >
      <ExtensionNavigation
        host={ext.host}
        manifests={ext.state.native?.installations.map((item) => item.manifest) ?? []}
        activeView={extensionView}
        onOpenSurface={openExtension}
        onError={reportError}
      />
    </LeadingNavigation>
  )
  return (
    <ExtensionsHostProvider
      value={{
        i18n: { language: i18n.language },
        openLink: pluginsHost.openLink,
        reportError,
        confirm: (message, title) => ask(message, { title, kind: "warning" }),
        notify: (message) => void toast.success(message)
      }}
    >
      <DesktopLeading navigation={navigation}>
        {page === "archives" && <ArchivedSessions />}
        {page === "pets" && petsReady && <PetCenter />}
        {toolboxVisited && (
          <div className={toolbox && extensionView === null ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
            <PluginsProvider host={pluginsHost} client={client}>
              <PluginsPage
                cwd={cwd}
                active={page === "plugins"}
                onOpenCatalog={() => openToolbox("plugins")}
                extensions={{
                  active: page === "extensions",
                  onOpen: () => openToolbox("extensions"),
                  content: (
                    <Pane className="pe-0" viewportClassName="pe-0">
                      <div className={`${toolboxContentClassName} pt-8`}>
                        <ExtensionsSection runtime={ext.runtime} start={extensions.start} pickLocal={pickLocalExtension} onOpenSurface={openExtension} />
                      </div>
                    </Pane>
                  )
                }}
              />
            </PluginsProvider>
          </div>
        )}
        {extensionView !== null && <ExtensionPage runtime={ext.runtime} id={extensionView} onClose={() => setExtensionView(null)} />}
      </DesktopLeading>
    </ExtensionsHostProvider>
  )
}
