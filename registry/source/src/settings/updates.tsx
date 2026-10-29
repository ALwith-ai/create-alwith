import { checkForUpdates, installUpdate, type DesktopUpdate } from "@alwith/module-desktop-shell"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import app from "../../alwith.app.json"

type Status =
  | { kind: "idle" | "checking" | "upToDate" }
  | { kind: "available" | "installing"; update: DesktopUpdate }
  | { kind: "failed"; message: string }

/** Manual update check against the app's GitHub release manifest; the shell downloads, verifies, installs and relaunches. */
export function UpdatesRow() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const busy = status.kind === "checking" || status.kind === "installing"
  const fail = (error: unknown) => setStatus({ kind: "failed", message: error instanceof Error ? error.message : String(error) })
  async function check() {
    setStatus({ kind: "checking" })
    try { const update = await checkForUpdates(); setStatus(update ? { kind: "available", update } : { kind: "upToDate" }) } catch (error) { fail(error) }
  }
  async function install(update: DesktopUpdate) {
    setStatus({ kind: "installing", update })
    try { await installUpdate() } catch (error) { fail(error) }
  }
  const caption = status.kind === "checking" ? t("updates.checking")
    : status.kind === "upToDate" ? t("updates.upToDate", { version: app.version })
    : status.kind === "available" ? t("updates.available", { version: status.update.version })
    : status.kind === "installing" ? t("updates.installing", { version: status.update.version })
    : status.kind === "failed" ? status.message
    : t("updates.version", { version: app.version })
  return <div className="flex items-center justify-between gap-4">
    <div className="min-w-0">
      <h2 className="text-sm font-medium">{t("updates.title")}</h2>
      <p className={`truncate text-sm ${status.kind === "failed" ? "text-destructive" : "text-muted-foreground"}`} role="status">{caption}</p>
    </div>
    <Button variant="outline" disabled={busy} onClick={() => void (status.kind === "available" ? install(status.update) : check())}>
      {busy && <Spinner data-icon="inline-start" />}
      {t(status.kind === "available" ? "updates.install" : "updates.check")}
    </Button>
  </div>
}
