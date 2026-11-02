import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyTemplate } from "../src/template";

test("template expansion excludes installed dependencies and build state at every depth", async () => {
  const root = await mkdtemp(join(tmpdir(), "template-copy-"));
  try {
    const source = join(root, "source");
    for (const path of ["node_modules", "src-tauri/target", "src-tauri/binaries", "src-tauri/resources", "src-tauri/gen", "dist", ".cache", ".git"]) {
      await mkdir(join(source, path), { recursive: true });
      await writeFile(join(source, path, "local-state"), "must not ship");
    }
    await symlink(join(root, "missing"), join(source, "node_modules", "broken-link"));
    await writeFile(join(source, "bun.lock"), "frozen dependencies");
    await writeFile(join(source, "src-tauri", "Cargo.lock"), "frozen native dependencies");
    const output = join(root, "output");
    await copyTemplate(source, output);
    expect((await readdir(output)).sort()).toEqual(["bun.lock", "src-tauri"]);
    expect(await readdir(join(output, "src-tauri"))).toEqual(["Cargo.lock"]);
    expect(await readFile(join(output, "bun.lock"), "utf8")).toBe("frozen dependencies");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("an existing brand config and icon reproduce the app without copying its source tree", async () => {
  const { generateProject } = await import("../src/generate");
  const root = await mkdtemp(join(tmpdir(), "template-brand-"));
  try {
    const icon = '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="green"/></svg>';
    await mkdir(join(root, "assets"));
    await writeFile(join(root, "assets/icon.svg"), icon);
    const config = {name: "customer-buddy", productName: "Customer Buddy", identifier: "com.example.customer", version: "1.2.3", icon: "assets/icon.svg", languages: ["en", "zh-CN"], window: {width: 1100, height: 750, minWidth: 800, minHeight: 550}, preset: "chat", modules: ["chat", "store"]};
    await writeFile(join(root, "alwith.app.json"), JSON.stringify(config));
    await writeFile(join(root, "private-source.ts"), "must not copy");
    const output = await generateProject({directory: join(root, "output"), name: config.name, productName: config.productName, identifier: config.identifier, configFile: join(root, "alwith.app.json")});
    const actual = JSON.parse(await readFile(join(output, "alwith.app.json"), "utf8"));
    for (const [key, value] of Object.entries(config)) expect(actual[key]).toEqual(value);
    expect(await readFile(join(output, "assets/icon.svg"), "utf8")).toBe(icon);
    const second = await generateProject({directory: join(root, "second"), name: config.name, productName: config.productName, identifier: config.identifier, configFile: join(root, "alwith.app.json")});
    expect(await readFile(join(output, ".alwith/template.json"), "utf8")).toBe(await readFile(join(second, ".alwith/template.json"), "utf8"));
    expect(await Bun.file(join(output, "private-source.ts")).exists()).toBe(false);
    expect(JSON.parse(await readFile(join(output, "package.json"), "utf8")).dependencies["@alwith/module-auth"]).toBeUndefined();
  } finally { await rm(root, { recursive: true, force: true }); }
});
