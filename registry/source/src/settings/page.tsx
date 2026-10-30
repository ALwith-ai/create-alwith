import { useState } from "react"
import { useTranslation } from "react-i18next"
import { LogOutIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { logoutPlatform, usePlatformAuth } from "../auth/store"
import { UpdatesRow } from "./updates"
import app from "../../alwith.app.json"

/** Default settings page; application authors may replace this whole component. */
export function SettingsPage() {
  const {i18n, t} = useTranslation()
  const account = usePlatformAuth(state => state.user?.login_email)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const zh = i18n.language.startsWith("zh")
  async function signOut() {
    setBusy(true); setError(null)
    try { await logoutPlatform() } catch (error) { setError(error instanceof Error ? error.message : String(error)) } finally { setBusy(false) }
  }
  return <section className="desktop-shell-settings-page">
    <header className="desktop-shell-chat-header" data-tauri-drag-region>
      <h1 className="text-sm font-medium">{t("settings")}</h1>
    </header>
    <div className="desktop-shell-settings-content">
      <div className="desktop-shell-settings-row">
        <div className="min-w-0"><h2 className="text-sm font-medium">{zh ? "账号" : "Account"}</h2><p className="truncate text-sm text-muted-foreground">{account}</p></div>
        <Button variant="outline" disabled={busy} onClick={() => void signOut()}><LogOutIcon data-icon="inline-start"/>{t("signOut")}</Button>
      </div>
      <div className="desktop-shell-settings-row">
        <h2 className="text-sm font-medium">{zh ? "语言" : "Language"}</h2>
        <Tabs value={zh ? "zh-CN" : "en"} onValueChange={value => void i18n.changeLanguage(value)}>
          <TabsList aria-label={zh ? "语言" : "Language"}>{app.languages.map(language => <TabsTrigger key={language} value={language}>{language === "zh-CN" ? "中文" : "English"}</TabsTrigger>)}</TabsList>
        </Tabs>
      </div>
      <div className="desktop-shell-settings-row"><h2 className="text-sm font-medium">{zh ? "外观" : "Appearance"}</h2><span className="text-sm text-muted-foreground">{zh ? "跟随系统" : "System appearance"}</span></div>
      {"updates" in app && <UpdatesRow />}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    </div>
  </section>
}
