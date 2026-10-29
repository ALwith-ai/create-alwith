import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateProject, generateProjectWithResult } from "../src/generate";
import { configureProject, safePath } from "../src/config";
const roots: string[] = [];
const options = {
  name: "my-buddy",
  productName: "My Buddy",
  identifier: "com.example.buddy",
};
async function destination() {
  const root = await mkdtemp(join(tmpdir(), "create-alwith-test-"));
  roots.push(root);
  return join(root, "app");
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
test("expands a complete chat preset offline and derives all brand configuration", async () => {
  const directory = await destination();
  await generateProject({ ...options, directory });
  const manifest = JSON.parse(
    await readFile(join(directory, "package.json"), "utf8"),
  );
  expect(manifest.name).toBe("my-buddy");
  expect(manifest.overrides).toBeUndefined();
  expect(manifest.dependencies["@alwith/module-desktop-shell"]).toStartWith(
    "^",
  );
  const conf = JSON.parse(
    await readFile(join(directory, "src-tauri/tauri.conf.json"), "utf8"),
  );
  expect(conf.productName).toBe("My Buddy");
  expect(conf.identifier).toBe("com.example.buddy");
  expect(conf.app.windows[0].transparent).toBe(true);
  expect(await readFile(join(directory, "src/App.tsx"), "utf8")).toContain(
    "client.newSession()",
  );
  expect(
    await readFile(join(directory, "src/auth/auth-gate.tsx"), "utf8"),
  ).toContain("PlatformLogin");
  expect(await readFile(join(directory, "src/auth/pets.ts"), "utf8")).toContain(
    "configurePetApplication",
  );
  expect(await readFile(join(directory, "src/vibemon.tsx"), "utf8")).toContain(
    "PetWindow",
  );
  expect(
    await readFile(join(directory, "src/vibemon-bubble.tsx"), "utf8"),
  ).toContain("PetQuickReply");
  expect(
    await readFile(join(directory, "src-tauri/Cargo.toml"), "utf8"),
  ).toContain('features = ["pets"]');
  const capabilities = JSON.parse(
    await readFile(
      join(directory, "src-tauri/capabilities/default.json"),
      "utf8",
    ),
  );
  expect(capabilities.permissions).toContain("alwith-auth-client:pets");
  expect(
    await readFile(join(directory, "src-tauri/src/main.rs"), "utf8"),
  ).toContain("alwith_app::run");
  expect(await readFile(join(directory, "AGENTS.md"), "utf8")).toContain(
    "startTestRuntime",
  );
});
test("configuration changes update generated names without rewriting an edited page", async () => {
  const directory = await destination();
  await generateProject({ ...options, directory });
  const file = join(directory, "alwith.app.json");
  const config = JSON.parse(await readFile(file, "utf8"));
  config.productName = "Changed & Co";
  await writeFile(file, JSON.stringify(config));
  await writeFile(join(directory, "src/App.tsx"), "// user-owned page\n");
  await configureProject(directory, { icons: false });
  expect(await readFile(join(directory, "src/App.tsx"), "utf8")).toBe(
    "// user-owned page\n",
  );
  expect(await readFile(join(directory, "index.html"), "utf8")).toContain(
    "Changed &amp; Co",
  );
  expect(
    await readFile(join(directory, "src-tauri/Cargo.toml"), "utf8"),
  ).toContain('[[bin]]\nname = "my-buddy"');
  const tauri = JSON.parse(
    await readFile(join(directory, "src-tauri/tauri.conf.json"), "utf8"),
  );
  expect(tauri.productName).toBe("Changed & Co");
  expect(tauri.mainBinaryName).toBe("my-buddy");
});
test("refuses an existing output directory without touching its files", async () => {
  const directory = await destination();
  await mkdir(directory);
  await writeFile(join(directory, "mine"), "keep");
  await expect(generateProject({ ...options, directory })).rejects.toThrow();
  expect(await readFile(join(directory, "mine"), "utf8")).toBe("keep");
});
test("requires an explicit valid identifier and confines snapshot paths", async () => {
  await expect(
    generateProject({
      ...options,
      directory: await destination(),
      identifier: "",
    }),
  ).rejects.toThrow("identifier");
  expect(() => safePath("/project", "../outside")).toThrow("escapes");
  expect(() => safePath("/project", "/absolute")).toThrow("relative");
});

test("cancellation removes only the newly created output and permits retry", async () => {
  const directory = await destination();
  const controller = new AbortController();
  await expect(
    generateProject({
      ...options,
      directory,
      signal: controller.signal,
      onProgress(phase) {
        if (phase === "registry") controller.abort();
      },
    }),
  ).rejects.toMatchObject({ code: "CANCELLED" });
  await generateProject({ ...options, directory });
  expect(
    JSON.parse(await readFile(join(directory, "alwith.app.json"), "utf8")).name,
  ).toBe(options.name);
});

test("CLI returns structured progress and result, then safely refuses the same directory", async () => {
  const directory = await destination();
  const args = [
    process.execPath,
    "src/cli.ts",
    directory,
    "--name",
    options.name,
    "--product-name",
    options.productName,
    "--identifier",
    options.identifier,
    "--preset",
    "chat",
    "--auth",
    "alwith",
    "--yes",
    "--json",
  ];
  async function run() {
    const child = Bun.spawn(args, {
      cwd: new URL("..", import.meta.url).pathname,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return {
      events: stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line)),
      stderr,
      exitCode,
    };
  }
  const first = await run();
  expect(first.exitCode).toBe(0);
  expect(first.stderr).toBe("");
  expect(
    first.events.filter((e) => e.type === "progress").map((e) => e.phase),
  ).toEqual(["validate", "template", "registry", "configure", "complete"]);
  expect(first.events.at(-1)).toMatchObject({
    type: "result",
    ok: true,
    directory,
  });
  const second = await run();
  expect(second.exitCode).toBe(1);
  expect(second.events.at(-1)).toMatchObject({
    type: "result",
    ok: false,
    error: { code: "DIRECTORY_EXISTS" },
  });
});

test("the same input produces the same ownership and recovery baseline", async () => {
  const a = await destination(),
    b = await destination();
  await generateProject({ ...options, directory: a });
  await generateProject({ ...options, directory: b });
  const first = await readFile(join(a, ".alwith/template.json"), "utf8");
  expect(first).toBe(await readFile(join(b, ".alwith/template.json"), "utf8"));
  const baseline = JSON.parse(first);
  expect(
    baseline.files.find((f: any) => f.path === "src/App.tsx"),
  ).toMatchObject({ owner: "user", source: "registry/chat" });
  expect(
    baseline.files.find((f: any) => f.path === "src-tauri/tauri.conf.json"),
  ).toMatchObject({ owner: "generator", source: "alwith.app.json" });
  expect(
    baseline.files.every((f: any) => /^[a-f0-9]{64}$/.test(f.sha256)),
  ).toBe(true);
});

test("bare chat removes account code, native plugins, permissions and direct dependencies", async () => {
  const directory = await destination();
  await generateProject({ ...options, directory, auth: "none" });
  const pkg = JSON.parse(
    await readFile(join(directory, "package.json"), "utf8"),
  );
  for (const name of [
    "@alwith/module-auth",
    "@alwith/native-auth",
    "@alwith/native-kit",
    "@tauri-apps/plugin-http",
    "@tauri-apps/plugin-os",
  ])
    expect(pkg.dependencies[name]).toBeUndefined();
  for (const path of [
    "src/auth/store.ts",
    "src/auth/pets.ts",
    "src/vibemon.tsx",
    "src/vibemon-bubble.tsx",
    "vibemon.html",
    "vibemon-bubble.html",
  ]) {
    expect(await Bun.file(join(directory, path)).exists()).toBe(false);
  }
  for (const path of [
    "src/App.tsx",
    "src/i18n.ts",
    "src/index.css",
    "vite.config.ts",
  ]) {
    expect(await readFile(join(directory, path), "utf8")).not.toMatch(
      /module-auth|PetCenter|PetLounge|vibemon|auth\/pets/,
    );
  }
  for (const path of [
    "src/main.tsx",
    "src/settings/page.tsx",
    "src/layout/navigation.tsx",
    "src-tauri/src/lib.rs",
    "scripts/stage.ts",
  ]) {
    expect(await readFile(join(directory, path), "utf8")).not.toMatch(
      /AuthGate|logoutPlatform|usePlatformAuth|alwith_auth_client|stageNativeAuth/,
    );
  }
  const config = JSON.parse(
    await readFile(join(directory, "alwith.app.json"), "utf8"),
  );
  expect(config.modules).toEqual(["chat", "store"]);
  expect(await readFile(join(directory, "bun.lock"), "utf8")).not.toMatch(
    /module-auth|native-auth|native-kit/,
  );
  expect(
    await readFile(join(directory, "src-tauri/Cargo.lock"), "utf8"),
  ).not.toMatch(/alwith-auth-client|alwith-native-client/);
  const capabilities = JSON.parse(
    await readFile(
      join(directory, "src-tauri/capabilities/default.json"),
      "utf8",
    ),
  );
  expect(capabilities.permissions).not.toContain("alwith-auth-client:default");
  expect(
    capabilities.permissions.every(
      (value: unknown) => typeof value === "string",
    ),
  ).toBe(true);
  const tauri = JSON.parse(
    await readFile(join(directory, "src-tauri/tauri.conf.json"), "utf8"),
  );
  expect(tauri.bundle.resources["resources/native"]).toBeUndefined();
});

test("rejects invalid account modes before creating output", async () => {
  const directory = await destination();
  await expect(
    generateProject({ ...options, directory, auth: "unknown" as never }),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  expect(await Bun.file(join(directory, "package.json")).exists()).toBe(false);
});

test("updates write a key pair outside the project and configure the GitHub release endpoint", async () => {
  const directory = await destination();
  const keyDirectory = join(await destination(), "keys");
  const result = await generateProjectWithResult({
    ...options,
    directory,
    updates: { github: "example/my-buddy", keyPassword: "pw", keyDirectory },
  });
  expect(result.updates).toEqual({ github: "example/my-buddy", privateKey: join(keyDirectory, "my-buddy.key") });
  const config = JSON.parse(await readFile(join(directory, "alwith.app.json"), "utf8"));
  expect(config.updates.github).toBe("example/my-buddy");
  expect(config.updates.pubkey).toBe(await readFile(join(keyDirectory, "my-buddy.key.pub"), "utf8"));
  expect(Buffer.from(config.updates.pubkey, "base64").toString()).toStartWith("untrusted comment: minisign public key: ");
  const privateKey = await readFile(join(keyDirectory, "my-buddy.key"), "utf8");
  expect(privateKey).toMatch(/^[A-Za-z0-9+/]+=*$/);
  const tree = await Bun.$`grep -rl ${privateKey} ${directory}`.nothrow().text();
  expect(tree).toBe("");
  const tauri = JSON.parse(await readFile(join(directory, "src-tauri/tauri.conf.json"), "utf8"));
  expect(tauri.plugins.updater).toEqual({
    pubkey: config.updates.pubkey,
    endpoints: ["https://github.com/example/my-buddy/releases/latest/download/latest.json"],
    requireSignedVersion: true,
  });
  expect(tauri.bundle.createUpdaterArtifacts).toBe(true);
  expect(await readFile(join(directory, "src-tauri/src/lib.rs"), "utf8")).toContain("tauri_plugin_updater::Builder::new().build()");
  expect(await readFile(join(directory, ".github/workflows/release.yml"), "utf8")).toContain("release-manifest.ts collect");
  expect(await readFile(join(directory, "src/settings/updates.tsx"), "utf8")).toContain("checkForUpdates");
  expect(JSON.parse(await readFile(join(directory, ".alwith/template.json"), "utf8")).updates).toEqual({ github: "example/my-buddy" });
  // An existing key is never overwritten, and nothing is generated when the input is refused.
  const again = join(await destination(), "again");
  await expect(generateProjectWithResult({ ...options, directory: again, updates: { github: "example/my-buddy", keyDirectory } })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  expect(await Bun.file(join(again, "package.json")).exists()).toBe(false);
  expect(await readFile(join(keyDirectory, "my-buddy.key"), "utf8")).toBe(privateKey);
  await expect(generateProjectWithResult({ ...options, directory: again, updates: { github: "not a repo", keyDirectory } })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  // Reusing a public key writes no key file.
  const reuse = await generateProjectWithResult({ ...options, name: "reuse-buddy", directory: again, updates: { github: "example/my-buddy", pubkey: config.updates.pubkey, keyDirectory } });
  expect(reuse.updates).toEqual({ github: "example/my-buddy" });
  expect(await Bun.file(join(keyDirectory, "reuse-buddy.key")).exists()).toBe(false);
  expect(JSON.parse(await readFile(join(again, "alwith.app.json"), "utf8")).updates.pubkey).toBe(config.updates.pubkey);
});

test("without updates the generated app has no updater configuration", async () => {
  const directory = await destination();
  await generateProject({ ...options, directory });
  const tauri = JSON.parse(await readFile(join(directory, "src-tauri/tauri.conf.json"), "utf8"));
  expect(tauri.plugins).toBeUndefined();
  expect(tauri.bundle.createUpdaterArtifacts).toBeUndefined();
  expect(JSON.parse(await readFile(join(directory, "alwith.app.json"), "utf8")).updates).toBeUndefined();
  expect(await readFile(join(directory, "src/settings/page.tsx"), "utf8")).toContain('"updates" in app && <UpdatesRow />');
});
