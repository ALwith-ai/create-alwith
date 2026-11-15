import { initializeDesktopZoom } from "@alwith/module-desktop-shell/zoom"
import { createRoot } from "react-dom/client"
import { GuidePage } from "./guide/page"
import "./i18n"
import "./index.css"
import "./theme"
await initializeDesktopZoom().catch((error: unknown) => console.error("Desktop zoom initialization failed", error))
createRoot(document.getElementById("root")!).render(<div className="desktop-shell-settings"><GuidePage /></div>)
