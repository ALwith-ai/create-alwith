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
