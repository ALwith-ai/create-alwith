# create-alwith

Generate a standalone ALwith WorkBuddy with a Tauri desktop shell and editable shadcn page blocks. Source repository: [ALwith-ai/create-alwith](https://github.com/ALwith-ai/create-alwith).

The template uses published npm dependencies and includes verified Bun and Cargo lockfiles. The first supported installation target is macOS on Apple silicon.

## Usage

```sh
bun create alwith ./my-buddy --name my-buddy --product-name 'My Buddy' --identifier com.example.buddy --preset chat --yes
cd my-buddy
bun install
bun run app-config
bun run dev:tauri
```

Without `--yes`, an interactive terminal prompts for missing fields. Agent and U callers use `--yes --json`: stdout contains newline-delimited progress events followed by one structured result. Errors carry stable codes (`INVALID_INPUT`, `DIRECTORY_EXISTS`, `CANCELLED`, `SNAPSHOT_INVALID`, `GENERATION_FAILED`). Cancellation removes the newly generated directory; an existing directory is never overwritten. Retry a cancelled generation with the same command.

Expansion is offline. The shell and frozen registry blocks become files in your project. Edit or replace whole pages. `.alwith/template.json` records each file’s owner, source and initial content hash, plus configuration-owned fields; repeated generation with the same inputs produces the same baseline. `alwith.app.json` is the single brand configuration; `bun run app-config` regenerates configuration and icons without overwriting pages.

Runtime manages agents. Codex ACP owns project context and conversations; API supplies shared Runtime transport. The default shell provides transparency, native menus and Atlas integration. This first acceptance target is macOS; Windows verification is deferred.

## Development

Use Bun 1.4.4. `bun run check:source` validates the source distribution and registry snapshots without installing platform dependencies. `bun install` and `bun test` exercise offline project generation.

`registry.json` defines the default login, chat, sidebar, shell and settings blocks. `bun run build:registry` uses shadcn 4.22.1 and records SHA-256 hashes. The generator uses those same immutable snapshots. Upgrade or replace pages through the standard shadcn workflow.

Release only after the public dependency set, generator and template lockfiles, and generated native application have been verified. The release workflow supports GitHub Actions trusted publishing after the package is configured on npm; local tarball overrides never enter a release.

## License

AGPL-3.0-only. See LICENSE and THIRD_PARTY_NOTICES.md.
