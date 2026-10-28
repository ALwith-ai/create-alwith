# Generated WorkBuddy

Brand configuration lives only in alwith.app.json. Run bun run app-config after changing it.
Use published npm packages with ^ version ranges and bun.lock. Never depend on a maintainer workspace or private source tree.
Runtime owns agents; never spawn Codex directly or create another session database. ACP and Codex project behavior belong in @nyssance/codex-acp-v2. API must not interpret protocol metadata.
Pages are editable @alwith registry blocks; replace an entire page to customize it. Shared capabilities belong in @alwith/module-* packages. Keep toolbars on one compact row and avoid decorative nested cards.
Test scripts that start Runtime use startTestRuntime from @alwith/api/node, with mocks by default. Live engine sessions require explicit authorization and an isolated home.
