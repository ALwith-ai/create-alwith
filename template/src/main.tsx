import { initializeDesktopShell } from "@alwith/module-desktop-shell"
import { initializeDesktopZoom } from "@alwith/module-desktop-shell/zoom"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App } from "./App"
import { AuthGate } from "./auth/auth-gate"
import { initPlatformAuth } from "./auth/store"
import { Toaster } from "./toaster"
import "./i18n"
import "./index.css"
import "./theme"

await initializeDesktopShell().catch((error: unknown) => console.error("Desktop shell initialization failed", error))
await initializeDesktopZoom().catch((error: unknown) => console.error("Desktop zoom initialization failed", error))
void initPlatformAuth()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
    <Toaster position="bottom-right" />
  </StrictMode>
)
