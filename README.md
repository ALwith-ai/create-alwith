# create-alwith

Generate a standalone ALwith WorkBuddy with a Tauri desktop shell and editable shadcn page blocks. Source repository: [ALwith-ai/create-alwith](https://github.com/ALwith-ai/create-alwith).

Local development requires Bun, Rust and the platform native compiler (Xcode command line tools on macOS). Run the generated project on your own computer; certificate purchase, notarization and cloud builds are not part of creation.

The template uses published npm dependencies and includes verified Bun and Cargo lockfiles. The first supported installation target is macOS on Apple silicon.

## Usage

```sh
bun create alwith ./my-buddy --name my-buddy --product-name 'My Buddy' --identifier com.example.buddy --preset chat --auth alwith --yes
cd my-buddy
bun install
bun run app-config
bun run dev:tauri
```

Add `--github owner/repo` for signed auto update through that repository's GitHub Releases: the generator creates a Tauri updater key pair, writes the private key to `~/.tauri/<name>.key` (never into the project; `--key-password` protects it, `--pubkey` reuses an existing public key instead) and records the repository and public key under `updates` in `alwith.app.json`. The generated `.github/workflows/release.yml` publishes a release of that repository from every `v<version>` tag; the generated README lists the secrets it needs.

Choose `--auth alwith` for ALwith account integration, or `--auth none` for bare chat without ALwith login and its native dependencies. Model provider authentication is separate in both modes. The choice is recorded by `modules` in `alwith.app.json`; account integration is a generation choice, not a runtime login bypass.

To recreate an existing brand in a new directory, use its configuration and icon:

```sh
bun src/cli.ts /tmp/my-buddy-check --config /path/to/alwith.app.json --yes
```

The generator preserves the brand, account choice, window, languages and public updater configuration. It copies the configured icon, never the existing application's source or installed dependencies. The destination must not exist. Use the normal generated project commands to build and run it independently.

Without `--yes`, an interactive terminal prompts for missing fields. Agent and U callers use `--yes --json`: stdout contains newline-delimited progress events followed by one structured result. Errors carry stable codes (`INVALID_INPUT`, `DIRECTORY_EXISTS`, `CANCELLED`, `SNAPSHOT_INVALID`, `GENERATION_FAILED`). Cancellation removes the newly generated directory; an existing directory is never overwritten.

Expansion is offline. The shell and frozen registry blocks become files in your project. Edit or replace whole pages. `.alwith/template.json` records each file’s owner, source and initial content hash, plus configuration-owned fields; repeated generation with the same inputs produces the same baseline. `alwith.app.json` is the single brand configuration; `bun run app-config` regenerates configuration and icons without overwriting pages.

Runtime manages agents. Codex ACP owns project context and conversations; API supplies shared Runtime transport. The default shell provides transparency, native menus and Atlas integration. This first acceptance target is macOS; Windows verification is deferred.

## Generated project commands

The generated project includes `fabfile.py` and `requirements-dev.txt`. After installing
its Bun dependencies, run `python3 -m pip install -r requirements-dev.txt` to enable
`fab dev` (alias `fab tauri`), `fab check`, `fab build`, and `fab upgrade` (alias `fab u`). Fabric wraps the existing
Bun/Tauri workflow and is optional; each generated project includes its own README.

## Development

Use Bun 1.4.4. `bun run check:source` validates the source distribution and registry snapshots without installing platform dependencies. `bun install` and `bun test` exercise offline project generation.

`registry.json` defines the default login, chat, sidebar, shell and settings blocks. `bun run build:registry` uses shadcn 4.22.1 and records SHA-256 hashes. The generator uses those same immutable snapshots. Upgrade or replace pages through the standard shadcn workflow.

Release only after the public dependency set, generator and template lockfiles, and generated native application have been verified. The release workflow supports GitHub Actions trusted publishing after the package is configured on npm; local tarball overrides never enter a release.

## License

AGPL-3.0-only. See LICENSE and THIRD_PARTY_NOTICES.md.

## Validate unpublished package candidates

Build and pack `@alwith/module-auth` and `@alwith/module-desktop-shell` locally,
then validate their archives without publishing:

```sh
bun scripts/check-candidates.ts /absolute/path/auth.tgz /absolute/path/desktop-shell.tgz
```

The check creates both account-enabled and bare-chat projects in a temporary
directory, installs the frozen dependencies from Bun's cache, and extracts the
candidate archives into their isolated `node_modules`. It checks frontend and
native compilation, independence, and unchanged production manifests and Bun
locks. Populate the dependency cache before running it. Cargo also runs offline;
`CARGO_TARGET_DIR` can select an existing local build cache. The printed temporary
directory is retained for inspection. This check does not launch Runtime or use
account credentials.
