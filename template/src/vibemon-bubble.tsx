import {initializeDesktopZoom} from "@alwith/module-desktop-shell/zoom"
import {createRoot} from "react-dom/client"
import {VibemonQuickReply} from "@alwith/module-auth/vibemon/react"
import {bootstrapVibemonWindow} from "@alwith/module-auth/vibemon/tauri"
import {initPlatformAuth} from "./auth/store"
import "./auth/vibemon"
import "./i18n"
import "./index.css"
import "./theme"
document.documentElement.style.background = "transparent"
document.body.style.background = "transparent"
await initPlatformAuth()
await initializeDesktopZoom().catch((error: unknown) => console.error("Desktop zoom initialization failed", error))
await bootstrapVibemonWindow()
createRoot(document.getElementById("root")!).render(<VibemonQuickReply />)
