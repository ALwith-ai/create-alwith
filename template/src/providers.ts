// Model providers (API keys, custom providers) live in module-chat's native plugin; this is the webview's port to it.
import { createProvidersPort } from "@alwith/module-chat/settings"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

export const providers = createProvidersPort({ invoke, listen })
