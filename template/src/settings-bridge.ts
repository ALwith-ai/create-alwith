// The settings window's side of the account bridge: it has no agent connection of its own and asks
// the main window over Tauri window events (`@alwith/module-chat/settings` owns the protocol).
import { createSettingsBridgeClient } from "@alwith/module-chat/settings"
import { emitTo, listen } from "@tauri-apps/api/event"

export const settingsBridge = createSettingsBridgeClient({ listen, emitTo })
