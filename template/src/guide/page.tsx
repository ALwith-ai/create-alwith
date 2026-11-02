import { CodexMarkdownRenderer } from "@alwith/module-chat/markdown"
import { openUrl } from "@tauri-apps/plugin-opener"
import { useTranslation } from "react-i18next"
import "@alwith/module-chat/markdown.css"

import content from "../../guide/index.md?raw"
import { useTheme } from "../theme"

const openLink = (url: string) => void openUrl(url)

/** Default user guide: the project's `guide/index.md`, rendered like a chat reply. Edit the Markdown; replace this page to change the layout. */
export function GuidePage() {
  const { t } = useTranslation()
  const theme = useTheme()
  return <section className="desktop-shell-settings-page">
    <header className="desktop-shell-chat-header" data-tauri-drag-region>
      <h1 className="text-sm font-medium">{t("userGuide")}</h1>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-6">
        <CodexMarkdownRenderer text={content} host={{ theme, copyLabel: t("copy"), openLink }} />
      </div>
    </div>
  </section>
}
