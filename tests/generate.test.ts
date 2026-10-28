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
  expect(await readFile(join(directory, "src-tauri/Cargo.toml"), "utf8")).toContain('[[bin]]\nname = "my-buddy"');
  const tauri = JSON.parse(await readFile(join(directory, "src-tauri/tauri.conf.json"), "utf8"));
  expect(tauri.productName).toBe("Changed & Co");
  expect(tauri.mainBinaryName).toBe("my-buddy");
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

test("cancellation removes only the newly created output and permits retry", async () => {
  const directory = await destination();
  const controller = new AbortController();
  await expect(generateProject({...options, directory, signal: controller.signal, onProgress(phase) {
    if (phase === "registry") controller.abort();
  }})).rejects.toMatchObject({code: "CANCELLED"});
  await generateProject({...options, directory});
  expect(JSON.parse(await readFile(join(directory, "alwith.app.json"), "utf8")).name).toBe(options.name);
});

test("CLI returns structured progress and result, then safely refuses the same directory", async () => {
  const directory = await destination();
  const args = [process.execPath, "src/cli.ts", directory, "--name", options.name, "--product-name", options.productName, "--identifier", options.identifier, "--preset", "chat", "--yes", "--json"];
  async function run() {
    const child = Bun.spawn(args, {cwd: new URL("..", import.meta.url).pathname, stdout: "pipe", stderr: "pipe"});
    const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    return {events: stdout.trim().split("\n").map(line => JSON.parse(line)), stderr, exitCode};
  }
  const first = await run();
  expect(first.exitCode).toBe(0);
  expect(first.stderr).toBe("");
  expect(first.events.filter(e => e.type === "progress").map(e => e.phase)).toEqual(["validate", "template", "registry", "configure", "complete"]);
  expect(first.events.at(-1)).toMatchObject({type: "result", ok: true, directory});
  const second = await run();
  expect(second.exitCode).toBe(1);
  expect(second.events.at(-1)).toMatchObject({type: "result", ok: false, error: {code: "DIRECTORY_EXISTS"}});
});
