import { initializeDesktopZoom } from "@alwith/module-desktop-shell/zoom"
import { createRoot } from "react-dom/client"
import { SettingsPage } from "./settings/page"
import { initPlatformAuth } from "./auth/store"
import "./i18n"
import "./index.css"
import "./theme"
void initPlatformAuth()
await initializeDesktopZoom().catch((error: unknown) => console.error("Desktop zoom initialization failed", error))
createRoot(document.getElementById("root")!).render(<SettingsPage />)
