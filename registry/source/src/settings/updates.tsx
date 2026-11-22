import { useDesktopUpdater } from "@alwith/module-desktop-shell/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import app from "../../alwith.app.json"
import i18n from "../i18n"

// The row's own strings: they come and go with auto update, a choice made when the application is created.
const STRINGS = {
  en: { title: "Updates", version: "Version {{version}}", checking: "Checking for updates…", upToDate: "Up to date ({{version}})", downloading: "Downloading {{version}}…", available: "Version {{version}} is ready to install", installing: "Installing {{version}}…", check: "Check for updates", install: "Relaunch to update" },
  "zh-CN": { title: "更新", version: "版本 {{version}}", checking: "正在检查更新…", upToDate: "已是最新（{{version}}）", downloading: "正在下载 {{version}}…", available: "版本 {{version}} 已可安装", installing: "正在安装 {{version}}…", check: "检查更新", install: "重新启动以更新" }
}
for (const [language, updates] of Object.entries(STRINGS)) i18n.addResourceBundle(language, "translation", { updates }, true, true)

/** The shell's updater: it checks and downloads in the background; this row shows where it stands, checks now, or relaunches. */
export function UpdatesRow() {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const fail = (reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason))
  const { state, check, confirmInstallAndRelaunch } = useDesktopUpdater({ onError: fail })
  const busy = state.type === "checkingForUpdates" || state.type === "downloading" || state.type === "restarting"
  const ready = state.type === "ready"
  const caption = error ?? (
    state.type === "checkingForUpdates" ? t("updates.checking")
    : state.type === "downloading" ? t("updates.downloading", { version: state.update.version })
    : state.type === "ready" ? t("updates.available", { version: state.update.version })
    : state.type === "restarting" ? t("updates.installing", { version: state.update.version })
    : state.type === "idle" ? t("updates.upToDate", { version: app.version })
    : t("updates.version", { version: app.version }))
  function act() {
    setError(null)
    void (ready ? confirmInstallAndRelaunch() : check()).catch(fail)
  }
  return <div className="flex items-center justify-between gap-4">
    <div className="min-w-0">
      <h2 className="text-sm font-medium">{t("updates.title")}</h2>
      <p className={`truncate text-sm ${error ? "text-destructive" : "text-muted-foreground"}`} role="status">{caption}</p>
    </div>
    <Button variant="outline" disabled={busy} onClick={act}>
      {busy && <Spinner data-icon="inline-start" />}
      {t(ready ? "updates.install" : "updates.check")}
    </Button>
  </div>
}
