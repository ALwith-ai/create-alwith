// Model providers (API keys, custom providers) live in module-chat's native plugin; this is the webview's port to it.
import { createProvidersPort } from "@alwith/module-chat/settings"

export const providers = createProvidersPort()
