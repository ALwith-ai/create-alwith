# Generated WorkBuddy

Develop, debug and validate with local candidate packages in isolated environments. Publish only after the complete implementation meets the final delivery standard and quality and compatibility checks pass. Never publish merely to unblock debugging or release repeatedly during development. Keep local candidate paths out of production manifests and lockfiles.
Brand configuration lives only in alwith.app.json. Run bun run app-config after changing it.
Use published npm packages with ^ version ranges and bun.lock. Never depend on a maintainer workspace or private source tree.
Runtime owns agents; never spawn Codex directly or create another session database. ACP and Codex project behavior belong in @nyssance/codex-acp-v2. API must not interpret protocol metadata.
Pages are editable @alwith registry blocks; replace an entire page to customize it. Shared capabilities belong in @alwith/module-* packages. Keep toolbars on one compact row and avoid decorative nested cards.
Prefer Hasgard for desktop debugging and UI verification: inspect the running application's snapshots, elements, interactions and logs. Use other tools when Hasgard is unavailable or unsuitable for the issue.
Do not design retries unless absolutely necessary. Report failures clearly without automatically repeating operations.
Test scripts that start Runtime use startTestRuntime from @alwith/api/node, with mocks by default. Live engine sessions require explicit authorization and an isolated home.
