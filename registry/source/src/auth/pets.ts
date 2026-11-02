import {configurePetApplication, initializeVibemonMain, updateMainPetSurface, requestPet} from "@alwith/module-auth/pets/tauri"
import {getCurrentWebviewWindow} from "@tauri-apps/api/webviewWindow"
import {openUrl} from "@tauri-apps/plugin-opener"
import {client} from "../client"
import {runtimePort, CODEX_AGENT_ID} from "../runtime"
import {openStore} from "../store"
import i18n from "../i18n"
import {authClient, API_BASE_URL, platformApiRequest, usePlatformAuth} from "./store"

configurePetApplication({
  auth: usePlatformAuth,
  apiBaseUrl: API_BASE_URL,
  storage: openStore("vibemon"),
  request: platformApiRequest,
  client,
  runtime: runtimePort,
  agentId: CODEX_AGENT_ID,
  markRead: id => runtimePort().markRead(id, client.state.runStates[id]?.version ?? null),
  async openChat(id) {
    window.dispatchEvent(new CustomEvent("pet:open-chat", {detail: id}))
    const main = getCurrentWebviewWindow()
    await main.show()
    await main.setFocus()
  },
  async openAccount() {
    const {otp} = await authClient.getSsoOtp()
    const url = new URL("/sso", import.meta.env.DEV ? "https://www-dev.alwith.ai" : "https://www.alwith.ai")
    url.searchParams.set("otp", otp)
    url.searchParams.set("redirect", "/account")
    await openUrl(url.href)
  },
  translate: (key, options) => String(i18n.t(key, options as never)),
  onError: error => window.dispatchEvent(new CustomEvent("pet:error", {detail: error instanceof Error ? error.message : String(error)}))
})
export {initializeVibemonMain, updateMainPetSurface, requestPet}
