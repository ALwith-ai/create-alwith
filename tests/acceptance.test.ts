import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { generateProject } from "../src/generate"

for (const auth of ["alwith", "none"] as const) {
  for (const name of ["acceptance-one", "acceptance-two"]) {
    test(`ships executable application acceptance: ${auth}/${name}`, async () => {
      const root = await mkdtemp(join(tmpdir(), "create-acceptance-"))
      try {
        const directory = join(root, "app")
        await generateProject({ directory, name, productName: `App ${name}`, identifier: `test.${name.replaceAll("-", ".")}`, auth })
        const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"))
        expect(manifest.scripts.test).toBe("bun test ./tests")
        expect(manifest.scripts["verify:native"]).toBe("bun scripts/verify.ts --native")
        const baseline = JSON.parse(await readFile(join(directory, ".alwith/template.json"), "utf8"))
        for (const path of ["tests/wiring.test.ts", "tests/configuration.test.ts", "tests/desktop/main.toml", "tests/desktop/settings.toml", "scripts/verify.ts", "docs/testing.md"]) {
          expect(baseline.files.find((file: { path: string }) => file.path === path)?.source).toBe("template")
          expect(await Bun.file(join(directory, path)).exists()).toBe(true)
        }
        // These configuration tests run without installing dependencies, proving the generated
        // cases adapt to both brands/account modes rather than merely existing in the archive.
        const run = () => Bun.spawnSync([process.execPath, "test", "./tests/configuration.test.ts"], { cwd: directory, stdout: "pipe", stderr: "pipe" })
        const valid = run()
        expect(valid.stderr.toString()).toContain("3 pass")
        expect(valid.exitCode).toBe(0)
        // Deliberate regression: generated tests must fail when native permissions disappear.
        const path = join(directory, "src-tauri/capabilities/default.json")
        const capabilities = JSON.parse(await readFile(path, "utf8"))
        capabilities.permissions = capabilities.permissions.filter((permission: unknown) => permission !== "core:window:allow-start-dragging")
        await writeFile(path, JSON.stringify(capabilities))
        expect(run().exitCode).not.toBe(0)
      } finally { await rm(root, { recursive: true, force: true }) }
    })
  }
}
