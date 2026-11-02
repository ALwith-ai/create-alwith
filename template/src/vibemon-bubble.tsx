import {createRoot} from "react-dom/client"
import {PetQuickReply} from "@alwith/module-auth/pets/react"
import {bootstrapVibemonWindow} from "@alwith/module-auth/pets/tauri"
import {initPlatformAuth} from "./auth/store"
import "./auth/pets"
import "./i18n"
import "./index.css"
import "./theme"
document.documentElement.style.background = "transparent"
document.body.style.background = "transparent"
await initPlatformAuth()
await bootstrapVibemonWindow()
createRoot(document.getElementById("root")!).render(<PetQuickReply />)
