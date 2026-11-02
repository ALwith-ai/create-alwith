// The 收藏 groups: module-chat's collection store persisted in this app's settings store
// (`collections.data`, revisioned by @alwith/module-store); one store per webview.
import { createCollectionStore } from "@alwith/module-chat/collections"
import { toast } from "sonner"

import { openStore } from "./store"

const settings = openStore("settings")
export const collections = createCollectionStore(
  {
    load: () => settings.get("collections.data").then((value) => value ?? null),
    save: (data) => settings.set("collections.data", data),
    subscribe: (listener) => settings.onKeyChange("collections.data", listener)
  },
  { reportError: (error) => void toast.error(error instanceof Error ? error.message : String(error)) }
)
