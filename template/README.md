# Your ALwith desktop app

Install Bun, Rust and your platform's native build tools (Xcode command line tools on macOS), then install the locked dependencies:

```sh
bun install --frozen-lockfile
```

For the optional Fabric commands, install Python and Fabric:

```sh
python3 -m pip install -r requirements-dev.txt
fab dev    # Run the desktop app with Hasgard enabled
fab check  # Check frontend and native compilation without starting a chat
fab build  # Build the desktop app and installer using local signing settings
```

`fab tauri` is an alias for `fab dev`. Commands run from this project's directory and stop on failure. Tauri's hooks stage the published Runtime and build or serve the frontend. No maintainer checkout is required.

Fabric is optional: `bun run app-config` followed by `bun run dev:tauri` or `bun run tauri build` uses the same workflow.

Edit `alwith.app.json` to change your app's branding. Edit the generated pages directly to customize the interface.

## Releases and auto update

When `alwith.app.json` has an `updates` section (`bun create alwith --github owner/repo` writes it), `.github/workflows/release.yml` turns every pushed `v<version>` tag into a GitHub Release of this repository with the signed, notarized macOS DMG, the updater archive, its signature and `latest.json`. The release is created only after every asset is ready, so the updater endpoint `https://github.com/owner/repo/releases/latest/download/latest.json` is valid as soon as the release exists. Installed copies check from Settings and download, verify and relaunch from there.

Set these repository secrets before tagging:

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE` | Base64 of the Developer ID Application certificate (`.p12`) |
| `APPLE_CERTIFICATE_PASSWORD` | Password of that `.p12` |
| `APPLE_SIGNING_IDENTITY` | The certificate's identity, e.g. `Developer ID Application: Name (TEAMID)` |
| `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` | Apple ID, an app-specific password and the team ID for notarization |
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of `~/.tauri/<name>.key` written at creation (the key never enters the project) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The key password; empty when the key has none |

The tag must equal `v` plus the `version` in `alwith.app.json`; bump it and run `bun run app-config` first. The public key stays in `updates.pubkey`; generating a new key means every installed copy must reinstall once. To add updates to an existing app, create a key with `bun run tauri signer generate -w ~/.tauri/<name>.key`, put the `.pub` file's contents and your `owner/repo` into `updates`, and rerun `bun run app-config`.
