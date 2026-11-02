import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ContrastIcon, CpuIcon, InfoIcon, LogOutIcon, SlidersHorizontalIcon, UserIcon } from "lucide-react"
import {
  AboutSection,
  AppearanceSection,
  GeneralSection,
  SettingGroup,
  SettingLabel,
  SettingRow,
  SettingsLayout,
  type SettingsSectionItem,
  useHideOnClose,
  useSettingsSection
} from "@alwith/module-desktop-shell/settings"
import { ConversationProvider } from "@alwith/module-chat/conversation"
import { ProviderSection } from "@alwith/module-chat/settings"
import { ExtensionMount, ExtensionSettingsContent, ExtensionSettingsNavigation, ExtensionsHostProvider, useExtensions } from "@alwith/module-extension/react"
import { ask } from "@tauri-apps/plugin-dialog"
import { openUrl } from "@tauri-apps/plugin-opener"
import { toast } from "sonner"
import { desktopSettingsLabels } from "@alwith/module-desktop-shell/react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { logoutPlatform, usePlatformAuth } from "../auth/store"
import { useChatHost } from "../chat-host"
import { extensions } from "../extensions"
import { client } from "../client"
import { providers } from "../providers"
import { settingsBridge } from "../settings-bridge"
import { changeLanguage, LANGUAGES } from "../i18n"
import { UpdatesRow } from "./updates"
import app from "../../alwith.app.json"
import "@alwith/module-desktop-shell/settings.css"

/** Default settings window: U's sections from the shell; application authors may replace this whole page. */
export function SettingsPage() {
  const { i18n, t } = useTranslation()
  const labels = desktopSettingsLabels(i18n.language)
  const user = usePlatformAuth(state => state.user)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const host = useChatHost(setError)
  useHideOnClose(error => setError(error instanceof Error ? error.message : String(error)))
  const sections: SettingsSectionItem[] = [
    { id: "account", label: labels.account, icon: UserIcon },
    { id: "general", label: labels.general, icon: SlidersHorizontalIcon },
    { id: "appearance", label: labels.appearance, icon: ContrastIcon },
    { id: "provider", label: i18n.t("settings.provider", { ns: "alwithChat" }), icon: CpuIcon },
    { id: "about", label: labels.about, icon: InfoIcon }
  ]
  const [section, setSection] = useSettingsSection(sections)
  // Extensions contribute settings pages below the sections (U: the same rows in this window).
  const reportError = (error: unknown) => setError(error instanceof Error ? error.message : String(error))
  const ext = useExtensions(extensions.getRuntime(), extensions.start, reportError)
  const [extensionSection, setExtensionSection] = useState<string | null>(null)
  async function signOut() {
    setBusy(true); setError(null)
    try { await logoutPlatform() } catch (error) { setError(error instanceof Error ? error.message : String(error)) } finally { setBusy(false) }
  }
  const content = (() => {
    if (extensionSection !== null) {
      return (
        <ExtensionSettingsContent
          id={extensionSection}
          views={ext.host.views}
          renderView={(view) => <ExtensionMount key={view.id} runtime={ext.runtime} id={view.id} />}
        />
      )
    }
    switch (section) {
      case "account":
        return user ? (
          <SettingGroup>
            <SettingRow title={user.nickname || user.login_email} desc={user.login_email}>
              <Button className="rounded-sm" variant="outline" disabled={busy} onClick={() => void signOut()}><LogOutIcon data-icon="inline-start"/>{t("signOut")}</Button>
            </SettingRow>
          </SettingGroup>
        ) : null
      case "appearance":
        return <AppearanceSection language={i18n.language} />
      case "provider":
        // U's models section: the Codex account over the main window's bridge, then the provider keys held by the native plugin.
        return (
          <ConversationProvider host={host} client={client}>
            <ProviderSection port={providers} bridge={settingsBridge} group={SettingGroup} label={SettingLabel} />
          </ConversationProvider>
        )
      case "about":
        return (
          <AboutSection language={i18n.language}>
            {"updates" in app && <UpdatesRow />}
            <SettingRow title={t("licensesTitle")} desc={t("licenses")} />
          </AboutSection>
        )
      default:
        return <GeneralSection language={i18n.language} languages={LANGUAGES} onLanguageChange={changeLanguage} />
    }
  })()
  return (
    <ExtensionsHostProvider
      value={{
        i18n: { language: i18n.language },
        openLink: (url) => void openUrl(url),
        reportError,
        confirm: (message, title) => ask(message, { title, kind: "warning" }),
        notify: (message) => void toast.success(message)
      }}
    >
      <SettingsLayout
        sections={sections}
        active={extensionSection === null ? section : null}
        onSelect={(id) => { setExtensionSection(null); setSection(id) }}
        label={labels.title}
        navigation={
          <ExtensionSettingsNavigation
            views={ext.host.views}
            manifests={ext.state.native?.installations.map((item) => item.manifest) ?? []}
            activeId={extensionSection}
            onSelect={setExtensionSection}
          />
        }
      >
        {content}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      </SettingsLayout>
    </ExtensionsHostProvider>
  )
}
