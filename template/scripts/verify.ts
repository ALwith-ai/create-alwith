import { resolve } from "node:path"

// Fail once at the failing gate. This never launches an app, Runtime or model session.
const root = resolve(import.meta.dirname, "..")
const native = process.argv.includes("--native")
const unknown = process.argv.slice(2).filter(arg => arg !== "--native")
if (unknown.length) throw new Error(`Unknown verification arguments: ${unknown.join(" ")}`)
const commands = [
  [process.execPath, "run", "test"],
  [process.execPath, "run", "check"],
  [process.execPath, "run", "check:independence"],
  [process.execPath, "run", "build"],
  ...(native ? [
    [process.execPath, "run", "stage"],
    [process.execPath, "run", "check:codex-signatures"],
    ["cargo", "check", "--manifest-path", "src-tauri/Cargo.toml", "--locked", "--features", "hasgard-testing"]
  ] : [])
]
for (const command of commands) {
  console.log(`\n> ${command.join(" ")}`)
  const child = Bun.spawn(command, { cwd: root, stdout: "inherit", stderr: "inherit", env: { ...process.env, CARGO_NET_RETRY: "0" } })
  const code = await child.exited
  if (code !== 0) process.exit(code || 1)
}
console.log(`PASS: ${native ? "frontend and native" : "frontend"} verification. Desktop interaction, real accounts/models and first-user timing are separate acceptance gates.`)
