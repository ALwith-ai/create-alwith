# Application acceptance

These tests travel with the generated project and are editable alongside its pages. Shared modules own their internal tests; create-alwith owns generation, two-brand/two-account-mode and package-content tests. This suite checks the generated application's native wiring and configuration, not a duplicate implementation of the modules.

## Default, isolated checks

After `bun install --frozen-lockfile`:

- `bun run test`: configuration and actual application Runtime/store wiring through mocked Tauri IPC. Covers session creation, prompt transport, incoming permission requests and responses, history transport, connection reset/exit, settings changes and error propagation. It does **not** prove chat rendering, model execution or disk persistence across application restarts.
- `bun run verify`: tests, type checking (including tests), independence and frontend build.
- `bun run verify:native` or `fab check`: the preceding checks, staging, vendor binary signature/byte checks and locked native compilation. Staging can download published artifacts. No app or agent is launched.
- After a local app build, run `bun run check:codex-signatures /path/to/Application.app` (on Windows, supply the directory containing the bundled executables).

Commands stop at the first failure. They do not retry, publish or push. Default tests never access credentials, launch Runtime or write real user settings. Any future test that needs a Runtime must use `startTestRuntime` from `@alwith/api/node` and dispose it in `finally` or with `await using`. Real engines require separate explicit authorization, and only then may `authFrom` copy credentials into the isolated home.

## Desktop smoke tests with Hasgard

Install `tauri-hasgard-cli` and use an explicitly chosen test application/socket. These scenarios act on an already running debug application; they never start one, sign in or send a model prompt. Opening the application itself can start its configured agent, so use an authorized acceptance environment. Do not point them at another user's application.

```sh
tauri-hasgard --socket /path/to/test-app.sock --window main run tests/desktop/main.toml --json
# Open Settings through the application's menu first:
tauri-hasgard --socket /path/to/test-app.sock --window settings run tests/desktop/settings.toml --json
```

In account mode, sign in first using a designated test account. In no-account mode, the main window is directly reachable. A login gate is not a passing main-window result. Scenarios fail on missing UI; they do not silently skip. These are structural smoke checks; complete the interaction cases below separately. If you replace a page, update its scenario around the intended behavior instead of retaining default CSS selectors as a product constraint.

## Required interactive acceptance cases

Record each as PASS, FAIL or NOT RUN with app/template/package versions, OS, account mode, evidence path and failure details. A NOT RUN case is not a pass. Keep recordings, reports and screenshots outside the template source.

| Case | Steps and expected result |
| --- | --- |
| Projects | Pick a recent project and a new directory; cancel the picker; start a quick chat. Confirm cwd, cancellation and grouping. |
| Navigation | Switch collections/chats/activity; create and finish work; verify activity membership, unread state and history after reopening. Check hover, active state, long names and keyboard navigation. |
| Window | Drag the title region, double-click to maximize/restore, open/close/reopen Settings. Verify focus and independent-window behavior. |
| Settings | Change appearance and language, verify main/settings synchronization, restart and verify persistence; restore the original values. Exercise enabled provider and extension settings. |
| Tools | Open plugins, Skills, extensions and archives. In an isolated test project, install/enable/disable a test extension and check its contributed page/settings. |
| Real chat and approvals | After explicit live-test authorization, send a harmless task in a temporary project, exercise approve and deny, confirm streamed result/error presentation and completion. |
| History | Restart the test app and reopen that conversation; confirm transcript and correct activity state without rerunning the old prompt. |
| Account and Vibemon | Only for auth-enabled builds: sign in, verify account settings and Vibemon entry/interaction, sign out. No-account builds must omit these while retaining core tools. |
| Real customization | Implement one user-described requirement, rebuild and restart, verify the behavior and persisted state. |
| First-user timing | A first-time user completes creation/customization/build/run; record prerequisites, all phase durations and failures against the one-hour goal. |

Never store account passwords, API keys, auth.json or private conversation contents in test fixtures or committed evidence. Mock success, build success, desktop smoke and live acceptance are separate results.
