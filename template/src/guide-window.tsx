import { createRoot } from "react-dom/client"
import { GuidePage } from "./guide/page"
import "./i18n"
import "./index.css"
import "./theme"
createRoot(document.getElementById("root")!).render(<div className="desktop-shell-settings"><GuidePage /></div>)
