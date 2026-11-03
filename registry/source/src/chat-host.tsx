// What module-chat's surfaces ask of the application: strings, theme, links, Markdown and error reporting.
// The same object serves the conversation and the session list.
import type { ConversationHost, ReportedError } from "@alwith/module-chat/conversation"
import { type PluginsHost, readSkillDocument } from "@alwith/module-chat/plugins"
import { CodexMarkdownRenderer } from "@alwith/module-chat/markdown"
import { PatchView } from "@alwith/module-chat/patch-view"
import { TerminalOutput } from "@alwith/module-chat/terminal-output"
import { chooseFolder, onDesktopMenu } from "@alwith/module-desktop-shell/native"
import { convertFileSrc } from "@tauri-apps/api/core"
import { openPath, openUrl, revealItemsInDir } from "@tauri-apps/plugin-opener"
import { toast } from "sonner"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { client } from "./client"
import { useTheme } from "./theme"

const openLink = (url: string) => void openUrl(url)

/** The native Find menu item (Cmd/Ctrl+F) opens the conversation's find bar while it is mounted. */
function subscribeSearch(open: () => void): () => void {
  let disposed = false
  let stop: (() => void) | undefined
  void onDesktopMenu("find", open).then((unlisten) => {
    if (disposed) unlisten()
    else stop = unlisten
  }).catch(console.error)
  return () => {
    disposed = true
    stop?.()
  }
}

export function useChatHost(report: (message: string) => void): ConversationHost {
  const { i18n } = useTranslation()
  const theme = useTheme()
  const language = i18n.language
  return useMemo<ConversationHost>(
    () => ({
      t: (key, values) => i18n.t(key, { ns: "alwithChat", ...values }),
      i18n: { language },
      theme,
      openLink,
      openImage: openLink,
      chooseFolder,
      subscribeSearch,
      Output: TerminalOutput,
      Patch: ({ patch }) => <PatchView patch={patch} theme={theme} />,
      Markdown: ({ text, streaming }) => (
        <CodexMarkdownRenderer text={text} streaming={streaming} host={{ theme, copyLabel: i18n.t("copy"), openLink }} />
      ),
      reportError: (error) => {
        const message = error instanceof Error ? error.message : String(error)
        const description = (error as ReportedError | null)?.description
        report(description ? `${message}: ${description}` : message)
      }
    }),
    [i18n, language, theme, report]
  )
}

/** What the toolbox (plugins and skills catalog) asks of the application. */
export function usePluginsHost(): PluginsHost {
  const { i18n } = useTranslation()
  const theme = useTheme()
  const language = i18n.language
  return useMemo<PluginsHost>(
    () => ({
      t: (key, values) => i18n.t(key, { ns: "alwithChat", ...values }),
      i18n: { language },
      theme,
      openLink,
      assetUrl: convertFileSrc,
      // SKILL.md through module-chat's plugin: the Codex home plus the skill folders of known projects.
      readFile: (path) => readSkillDocument(path, [...new Set(client.state.sessionList.map((row) => row.cwd))]),
      openPath,
      revealPath: revealItemsInDir,
      copyText: (text) => navigator.clipboard.writeText(text),
      notify: (message) => void toast.success(message),
      reportError: (error) => void toast.error(error instanceof Error ? error.message : String(error))
    }),
    [i18n, language, theme]
  )
}
