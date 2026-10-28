import { initializeDesktopShell } from "@alwith/module-desktop-shell"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App } from "./App"
import { AuthGate } from "./auth/auth-gate"
import { initPlatformAuth } from "./auth/store"
import "./i18n"
import "./index.css"
import "./theme"

await initializeDesktopShell().catch((error: unknown) => console.error("Desktop shell initialization failed", error))
void initPlatformAuth()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>
)
