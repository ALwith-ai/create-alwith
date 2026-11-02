// The appearance preference (light / dark / system) belongs to the desktop shell: it applies the
// `.dark` class before the first paint and keeps every window in step. Pages import this module once.
import { useDesktopTheme } from "@alwith/module-desktop-shell/settings"
import { initializeDesktopTheme } from "@alwith/module-desktop-shell/theme"

initializeDesktopTheme()

/** The theme on screen: light or dark. */
export function useTheme(): "dark" | "light" {
  return useDesktopTheme().theme
}
