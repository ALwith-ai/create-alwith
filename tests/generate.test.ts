import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateProject } from "../src/generate";
import { configureProject, safePath } from "../src/config";
const roots: string[] = [];
const options = {name: "my-buddy", productName: "My Buddy", identifier: "com.example.buddy"};
async function destination() {const root = await mkdtemp(join(tmpdir(), "create-alwith-test-")); roots.push(root); return join(root, "app");}
afterEach(async () => {await Promise.all(roots.splice(0).map(root => rm(root, {recursive: true, force: true})));});
test("expands a complete chat preset offline and derives all brand configuration", async () => {
  const directory = await destination();
  await generateProject({...options, directory});
  const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  expect(manifest.name).toBe("my-buddy");
  expect(manifest.overrides).toBeUndefined();
  expect(manifest.dependencies['@alwith/module-desktop-shell']).toStartWith("^");
  const conf = JSON.parse(await readFile(join(directory, "src-tauri/tauri.conf.json"), "utf8"));
  expect(conf.productName).toBe("My Buddy");
  expect(conf.identifier).toBe("com.example.buddy");
  expect(conf.app.windows[0].transparent).toBe(true);
  expect(await readFile(join(directory, "src/App.tsx"), "utf8")).toContain("client.newSession()");
  expect(await readFile(join(directory, "src/auth/auth-gate.tsx"), "utf8")).toContain("PlatformLogin");
  expect(await readFile(join(directory, "src-tauri/src/main.rs"), "utf8")).toContain("alwith_app::run");
  expect(await readFile(join(directory, "AGENTS.md"), "utf8")).toContain("startTestRuntime");
});
test("configuration changes update generated names without rewriting an edited page", async () => {
  const directory = await destination(); await generateProject({...options, directory});
  const file = join(directory, "alwith.app.json"); const config = JSON.parse(await readFile(file, "utf8"));
  config.productName = "Changed & Co"; await writeFile(file, JSON.stringify(config));
  await writeFile(join(directory, "src/App.tsx"), "// user-owned page\n");
  await configureProject(directory, {icons: false});
  expect(await readFile(join(directory, "src/App.tsx"), "utf8")).toBe("// user-owned page\n");
  expect(await readFile(join(directory, "index.html"), "utf8")).toContain("Changed &amp; Co");
  expect(await readFile(join(directory, "src-tauri/Cargo.toml"), "utf8")).toContain('name = "Changed & Co"');
});
test("refuses an existing output directory without touching its files", async () => {
  const directory = await destination(); await mkdir(directory); await writeFile(join(directory, "mine"), "keep");
  await expect(generateProject({...options, directory})).rejects.toThrow();
  expect(await readFile(join(directory, "mine"), "utf8")).toBe("keep");
});
test("requires an explicit valid identifier and confines snapshot paths", async () => {
  await expect(generateProject({...options, directory: await destination(), identifier: ""})).rejects.toThrow("identifier");
  expect(() => safePath("/project", "../outside")).toThrow("escapes");
  expect(() => safePath("/project", "/absolute")).toThrow("relative");
});
