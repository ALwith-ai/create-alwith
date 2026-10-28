// Follows the system appearance for the whole app, the login screen included: Tailwind's `dark`
// variant keys off the `.dark` class on <html>.
import { useSyncExternalStore } from "react"

const query = matchMedia("(prefers-color-scheme: dark)")
const apply = () => document.documentElement.classList.toggle("dark", query.matches)
apply()
query.addEventListener("change", apply)

export function useTheme(): "dark" | "light" {
  return useSyncExternalStore(
    (onChange) => {
      query.addEventListener("change", onChange)
      return () => query.removeEventListener("change", onChange)
    },
    () => (query.matches ? "dark" : "light")
  )
}
