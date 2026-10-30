import { createRoot } from "react-dom/client"
import { SettingsPage } from "./settings/page"
import { initPlatformAuth } from "./auth/store"
import "./i18n"
import "./index.css"
import "./theme"
void initPlatformAuth()
createRoot(document.getElementById("root")!).render(<div className="desktop-shell-settings"><SettingsPage /></div>)
