// The application extension runtime: U's default host from @alwith/module-extension, one per webview.
// The app supplies only its identity, language and toast; policies stay at the package defaults
// (HTTP denied, external links allowed) until this app needs otherwise.
import { defineDefaultExtensionRuntime } from "@alwith/module-extension/tauri"
import { toast } from "sonner"

import app from "../alwith.app.json"
import i18n from "./i18n"

export const extensions = defineDefaultExtensionRuntime({
  host: { id: app.identifier, version: app.version },
  language: () => i18n.language,
  notices: {
    show: (message, duration, onClose) => {
      const id = toast(message, { duration, onDismiss: onClose, onAutoClose: onClose })
      return { hide: () => toast.dismiss(id), setMessage: (next) => void toast(next, { id, duration }) }
    }
  }
})
if (import.meta.hot) import.meta.hot.dispose(() => void extensions.dispose())
