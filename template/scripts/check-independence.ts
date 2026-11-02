#!/usr/bin/env bun
// Independence gate (plan "核心矛盾与约束"): nothing may depend on the maintainer's workspace or
// ALwith private sources. Allowed: Cargo `path` into node_modules/@alwith/*/rust whose real path
// stays inside this project's node_modules. Checked: manifests, lockfiles, scripts, env files.
import { realpathSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const failures: string[] = []
const forbidden = [/\/Projects\/ALwith\b/, /"(file|link|workspace):/, /\.\.\/alwith-/]

function scan(file: string) {
  const text = readFileSync(file, "utf8")
  for (const pattern of forbidden) {
    const match = pattern.exec(text)
    if (match) failures.push(`${file}: forbidden reference ${JSON.stringify(match[0])}`)
  }
}
function walk(dir: string, out: string[]) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", "target", "dist", ".git", "binaries", "resources", "gen", "icons"].includes(entry)) continue
    const path = join(dir, entry)
    if (path.endsWith("check-independence.ts")) continue
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(json|toml|lock|ts|tsx|rs|sh|yml|yaml|env.*)$/.test(entry) || entry.startsWith(".env")) out.push(path)
  }
}
const files: string[] = []
walk(root, files)
for (const file of files) scan(file)

// Cargo path dependencies must resolve inside node_modules (no symlink escape).
const cargo = readFileSync(join(root, "src-tauri/Cargo.toml"), "utf8")
for (const match of cargo.matchAll(/path\s*=\s*"([^"]+)"/g)) {
  const target = resolve(root, "src-tauri", match[1])
  const nodeModules = realpathSync(join(root, "node_modules"))
  // `[[bin]] path = "src/main.rs"` names our own file, not a dependency.
  if (realpathSync(resolve(root, "src-tauri")) === realpathSync(resolve(target, "..", "..")) && !match[1].includes("node_modules")) continue
  if (!existsSync(target)) failures.push(`Cargo path missing: ${match[1]}`)
  else if (!realpathSync(target).startsWith(nodeModules + "/"))
    failures.push(`Cargo path escapes node_modules: ${match[1]} -> ${realpathSync(target)}`)
}
// Cargo.lock: every source must be a registry, not a path outside node_modules.
const lock = join(root, "src-tauri/Cargo.lock")
if (existsSync(lock)) {
  for (const match of readFileSync(lock, "utf8").matchAll(/source = "([^"]+)"/g)) {
    if (!/^registry\+/.test(match[1])) failures.push(`Cargo.lock non-registry source: ${match[1]}`)
  }
}
// @alwith/* come from the registry with a caret range; the lockfile pins the build. No link/file/workspace.
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
  for (const [name, version] of Object.entries(pkg[section] ?? {}) as [string, string][]) {
    if (name.startsWith("@alwith/") && !/^\^\d+\.\d+\.\d+$/.test(version))
      failures.push(`${name} must be a caret range on a registry version, got ${version}`)
  }
}
if (failures.length) {
  console.error("independence check FAILED:\n" + failures.map((f) => "  - " + f).join("\n"))
  process.exit(1)
}
console.log(`independence check passed (${files.length} files scanned)`)
