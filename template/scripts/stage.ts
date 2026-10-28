#!/usr/bin/env bun
// Stages the minimal sidecar set Tauri bundles: alwith-runtime, bun, codex, codex-code-mode-host,
// plus the codex-acp-v2 adapter bundle as a resource. Everything comes from installed npm packages.
import { stageNative as stageNativeAuth } from "@alwith/native-auth/stage"
import { stageRuntime } from "@alwith/runtime/stage"
import { $ } from "bun"
import { chmodSync, copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const binaries = join(root, "src-tauri/binaries")
const resources = join(root, "src-tauri/resources")
const licenses = join(resources, "licenses")
mkdirSync(binaries, { recursive: true })
mkdirSync(licenses, { recursive: true })

const TARGETS: Record<string, { bun: string; codex: string; exe: string }> = {
  "aarch64-apple-darwin": { bun: "@oven/bun-darwin-aarch64", codex: "darwin-arm64", exe: "" }
}
const host = (await $`rustc -vV`.text()).match(/^host: (.+)$/m)?.[1].trim()
const triple = process.argv[2] ?? process.env.TAURI_ENV_TARGET_TRIPLE ?? host
if (!triple || !TARGETS[triple]) throw new Error(`Unsupported target ${triple}; known: ${Object.keys(TARGETS)}`)
const target = TARGETS[triple]
const mac = triple.endsWith("apple-darwin")
const entitlements = join(root, "src-tauri/Entitlements.plist")

async function sign(path: string, withEntitlements = false) {
  if (!mac) return
  const identity = process.env.APPLE_SIGNING_IDENTITY
  const ent = withEntitlements ? ["--entitlements", entitlements] : []
  if (identity) await $`codesign --force --timestamp --options runtime ${ent} --sign ${identity} ${path}`.quiet()
  else await $`codesign --force ${ent} --sign - ${path}`.quiet()
  await $`codesign --verify --strict ${path}`.quiet()
}
function place(source: string, name: string, executable = true) {
  if (!existsSync(source)) throw new Error(`missing ${source}`)
  const destination = join(binaries, `${name}-${triple}${target.exe}`)
  copyFileSync(source, destination)
  if (executable && !target.exe) chmodSync(destination, 0o755)
  return destination
}

// 1. Runtime (checksum-verified by the package).
const runtime = stageRuntime(triple, join(binaries, `alwith-runtime-${triple}${target.exe}`), licenses)
await sign(runtime)
console.log(`alwith-runtime -> ${runtime}`)

// 2. Bun, runs the adapter.
const bun = place(join(root, "node_modules", target.bun, "bin", `bun${target.exe}`), "bun")
await sign(bun, true)
console.log(`bun -> ${bun}`)

// 3. Codex CLI and its sibling helper.
const codexPackage = join(root, `node_modules/@openai/codex-${target.codex}`)
for (const name of ["codex", "codex-code-mode-host"]) {
  const staged = place(join(codexPackage, "vendor", triple, "bin", `${name}${target.exe}`), name)
  await sign(staged)
  console.log(`${name} -> ${staged}`)
}

// 4. The ACP adapter, byte-for-byte from the published package.
const adapterDirectory = join(resources, "adapter")
mkdirSync(adapterDirectory, { recursive: true })
copyFileSync(join(root, "node_modules/@nyssance/codex-acp-v2/dist/index.js"), join(adapterDirectory, "codex-acp-v2.mjs"))
copyFileSync(join(root, "node_modules/@nyssance/codex-acp-v2/LICENSE"), join(licenses, "codex-acp-v2-LICENSE"))
console.log(`codex-acp-v2 -> ${join(adapterDirectory, "codex-acp-v2.mjs")}`)

// 5. The closed auth library that refreshes ALwith tokens, verified by its package before copying.
const nativeDirectory = join(resources, "native")
rmSync(nativeDirectory, { recursive: true, force: true })
const nativeAuth = stageNativeAuth(triple, nativeDirectory, licenses)
await sign(nativeAuth)
console.log(`native auth -> ${nativeAuth}`)
