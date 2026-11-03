import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
const root = resolve(import.meta.dirname, "..")
const json = (path: string) => JSON.parse(readFileSync(resolve(root, path), "utf8"))
const app = json("alwith.app.json")
const pkg = json("package.json")
const tauri = json("src-tauri/tauri.conf.json")
const capabilities = json("src-tauri/capabilities/default.json")
const permissions = capabilities.permissions.map((item: string | { identifier: string }) => typeof item === "string" ? item : item.identifier)

test("generated application metadata follows the single brand configuration", () => {
  expect(pkg.name).toBe(app.name)
  expect(pkg.version).toBe(app.version)
  expect(tauri.productName).toBe(app.productName)
  expect(tauri.identifier).toBe(app.identifier)
  expect(tauri.version).toBe(app.version)
  expect(tauri.mainBinaryName).toBe(app.name)
})

test("native permissions cover independent settings and window controls", () => {
  expect(capabilities.windows).toContain("main")
  expect(capabilities.windows).toContain("settings")
  for (const permission of ["alwith-store:default", "alwith-desktop-shell:default", "core:window:allow-start-dragging", "core:window:allow-internal-toggle-maximize", "core:webview:allow-create-webview-window"]) {
    expect(permissions).toContain(permission)
  }
})

test("account and Vibemon dependencies and permissions follow enabled modules", () => {
  const enabled = app.modules.includes("auth")
  expect(Boolean(pkg.dependencies["@alwith/module-auth"])).toBe(enabled)
  expect(permissions.includes("alwith-auth:default")).toBe(enabled)
  expect(permissions.includes("alwith-auth:vibemon")).toBe(enabled)
  expect(readFileSync(resolve(root, "src-tauri/Cargo.toml"), "utf8").includes("alwith-auth =")).toBe(enabled)
  expect(capabilities.windows.includes("vibemon")).toBe(enabled)
  // Core tools remain available in both account modes.
  for (const dependency of ["@alwith/module-chat", "@alwith/module-store", "@alwith/module-extension"]) expect(pkg.dependencies[dependency]).toBeDefined()
  // Module libraries ship inside the module packages and desktop-shell stages them; no @alwith/native-* package remains.
  for (const section of [pkg.dependencies, pkg.devDependencies]) {
    expect(Object.keys(section).filter(name => name.startsWith("@alwith/native-"))).toEqual([])
  }
})
