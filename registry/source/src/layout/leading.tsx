import appIcon from "@/generated/app-icon"
import { useTranslation } from "react-i18next"

/** The leading screen behind the navigation: a place for the user's own home or business pages. */
export function Leading() {
  const { t } = useTranslation()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <img src={appIcon} alt="" className="size-24" draggable={false} />
      <h1 className="text-xl font-semibold">{t("leadingTitle")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("leadingBody")}</p>
    </div>
  )
}
