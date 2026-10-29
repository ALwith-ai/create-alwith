#!/usr/bin/env bun
// Release helper for .github/workflows/release.yml. `check` validates the tag, the `updates` section and
// the secrets before anything is built; `collect <triple>` renames the Tauri bundle output into release/
// and writes the static updater manifest (latest.json) with the final download URLs of this repository's
// release, so it is correct before the release is created; `title` prints the release title.
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const app = JSON.parse(await readFile(join(root, "alwith.app.json"), "utf8")) as {
  name: string
  productName: string
  version: string
  updates?: { github: string; pubkey: string }
}
const [command, triple] = process.argv.slice(2)
const platforms: Record<string, string> = { "aarch64-apple-darwin": "darwin-aarch64" }

async function only(directory: string, suffix: string): Promise<string> {
  const matches = (await readdir(directory)).filter((name) => name.endsWith(suffix))
  if (matches.length !== 1) throw new Error(`Expected one ${suffix} in ${directory}, found ${matches.length}`)
  return join(directory, matches[0])
}

switch (command) {
  case "check": {
    if (!app.updates) throw new Error("alwith.app.json has no `updates` section; releases need the GitHub repository and the updater public key")
    const tag = process.env.RELEASE_TAG
    if (tag !== `v${app.version}`) throw new Error(`Release tag ${tag} does not match alwith.app.json version v${app.version}`)
    const required = ["APPLE_CERTIFICATE", "APPLE_CERTIFICATE_PASSWORD", "APPLE_SIGNING_IDENTITY", "APPLE_ID", "APPLE_PASSWORD", "APPLE_TEAM_ID", "TAURI_SIGNING_PRIVATE_KEY"]
    const missing = required.filter((name) => !process.env[name])
    if (missing.length) throw new Error(`Missing release secrets: ${missing.join(", ")}`)
    if (process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD === undefined) throw new Error("TAURI_SIGNING_PRIVATE_KEY_PASSWORD must be set (empty when the key has no password)")
    console.log(`Releasing ${app.productName} ${app.version} to https://github.com/${app.updates.github}/releases`)
    break
  }
  case "collect": {
    if (!app.updates) throw new Error("alwith.app.json has no `updates` section")
    const platform = platforms[triple ?? ""]
    if (!platform) throw new Error(`Unsupported target ${triple}; known: ${Object.keys(platforms).join(", ")}`)
    const bundle = join(root, "src-tauri/target", triple!, "release/bundle")
    const output = join(root, "release")
    await mkdir(output, { recursive: true })
    const archive = `${app.name}_${app.version}_${platform.replace("-", "_")}.app.tar.gz`
    await copyFile(await only(join(bundle, "macos"), ".app.tar.gz"), join(output, archive))
    await copyFile(await only(join(bundle, "macos"), ".app.tar.gz.sig"), join(output, `${archive}.sig`))
    await copyFile(await only(join(bundle, "dmg"), ".dmg"), join(output, `${app.name}_${app.version}_macos_${platform.split("-")[1]}.dmg`))
    const manifest = {
      version: app.version,
      notes: `${app.productName} ${app.version}`,
      pub_date: new Date().toISOString(),
      platforms: {
        [platform]: {
          signature: (await readFile(join(output, `${archive}.sig`), "utf8")).trim(),
          url: `https://github.com/${app.updates.github}/releases/download/v${app.version}/${archive}`
        }
      }
    }
    await writeFile(join(output, "latest.json"), JSON.stringify(manifest, null, 2) + "\n")
    console.log(`Collected ${(await readdir(output)).join(", ")} in ${output}`)
    break
  }
  case "title":
    console.log(`${app.productName} ${app.version}`)
    break
  default:
    throw new Error("Usage: bun scripts/release-manifest.ts <check|collect <triple>|title>")
}
