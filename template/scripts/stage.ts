#!/usr/bin/env bun
import { stageChatAdapter, stageEmojiData } from "@alwith/module-chat/stage"
// Stages the minimal sidecar set Tauri bundles: alwith-runtime, bun, codex, codex-code-mode-host,
// plus the codex-acp-v2 adapter bundle as a resource. Everything comes from installed npm packages.
import { ensureIcons } from "@alwith/module-desktop-shell/build"
import { stageNativeModule } from "@alwith/module-desktop-shell/stage"
import { stageRuntime } from "@alwith/runtime/stage"
import { $ } from "bun"
import { chmodSync, copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
// A fresh project has no bundle icons yet; tauri::generate_context! needs them before the first build.
await ensureIcons(root)
const binaries = join(root, "src-tauri/binaries")
const resources = join(root, "src-tauri/resources")
const licenses = join(resources, "licenses")
mkdirSync(binaries, { recursive: true })
mkdirSync(licenses, { recursive: true })

const TARGETS: Record<string, { bun: string; codex: string; exe: string }> = {
  "aarch64-apple-darwin": { bun: "@oven/bun-darwin-aarch64", codex: "darwin-arm64", exe: "" },
  "x86_64-pc-windows-msvc": { bun: "@oven/bun-windows-x64-baseline", codex: "win32-x64", exe: ".exe" }
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
const windowsHelpers = target.exe ? ["codex-windows-sandbox-setup", "codex-command-runner"] : []
for (const name of ["codex", "codex-code-mode-host", ...windowsHelpers]) {
  const directory = windowsHelpers.includes(name) ? "codex-resources" : "bin"
  const staged = place(join(codexPackage, "vendor", triple, directory, `${name}${target.exe}`), name)
  // Match ALwith U: preserve the vendor-signed Codex executables byte-for-byte.
  if (mac) await $`codesign --verify --strict ${staged}`.quiet()
  console.log(`${name} -> ${staged}`)
}

// 4. The ACP adapter, byte-for-byte from the published package.
const adapterDirectory = join(resources, "adapter")
stageChatAdapter(adapterDirectory, licenses)
console.log(`codex-acp-v2 -> ${join(adapterDirectory, "codex-acp-v2.mjs")}`)

// 4b. Emoji data for the 收藏 emoji picker, served from public/emojibase so the picker works offline.
const emojiDirectory = join(root, "public/emojibase")
stageEmojiData(emojiDirectory)
console.log(`emojibase -> ${emojiDirectory}`)

// 5. The precompiled module libraries from their installed @alwith/module-<module> packages, verified
// (identity, ABI, checksum) before copying: extension for every app, auth with ALwith accounts.
// ALwith libraries take the application identity; licence files stay plain resources.
const nativeDirectory = join(resources, "native")
rmSync(nativeDirectory, { recursive: true, force: true })
for (const module of ["extension", "auth"]) {
  for (const file of stageNativeModule(import.meta.url, module, triple, nativeDirectory, licenses)) {
    if (file.signing === "resign" && process.env.APPLE_SIGNING_IDENTITY) await sign(file.path)
  }
  console.log(`native ${module} -> ${nativeDirectory}`)
}
