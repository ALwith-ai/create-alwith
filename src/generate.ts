import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { configureProject, safePath, validateConfig, type AppConfig } from "./config";

const packageRoot = resolve(import.meta.dirname, "..");
export interface GenerateOptions {directory: string; name: string; productName: string; identifier: string}
/** Offline template expansion. Package installation and native builds are separate steps. */
export async function generateProject(options: GenerateOptions): Promise<string> {
  const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  const config: AppConfig = validateConfig({name: options.name, productName: options.productName, identifier: options.identifier, version: "0.1.0", icon: "assets/icon.svg", languages: ["en", "zh-CN"], window: {width: 1200, height: 800, minWidth: 900, minHeight: 600}, preset: "chat", modules: ["chat", "auth", "store"], template: {name: "create-alwith", version: manifest.version}});
  if (!options.directory) throw new Error("An output directory is required");
  const output = resolve(options.directory);
  await mkdir(dirname(output), {recursive: true});
  // Exclusive creation: never overwrite an existing project or a symlink.
  await mkdir(output);
  try {
    await cp(join(packageRoot, "template"), output, {recursive: true});
    await cp(join(packageRoot, "alwith.app.schema.json"), join(output, "alwith.app.schema.json"));
    const registry = JSON.parse(await readFile(join(packageRoot, "registry/built/manifest.json"), "utf8")) as {items: Array<{name: string; sha256: string}>};
    for (const item of registry.items) {
      const bytes = await readFile(safePath(join(packageRoot, "registry/built"), `${item.name}.json`));
      if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error(`Registry snapshot integrity failed: ${item.name}`);
      const block = JSON.parse(bytes.toString()) as {files: Array<{target: string; content: string}>};
      for (const file of block.files) {
        const destination = safePath(output, file.target);
        await mkdir(dirname(destination), {recursive: true});
        await writeFile(destination, file.content, {flag: "wx"});
      }
    }
    await writeFile(join(output, "alwith.app.json"), JSON.stringify({$schema: "./alwith.app.schema.json", ...config}, null, 2)+"\n");
    await mkdir(join(output, ".alwith"));
    await writeFile(join(output, ".alwith/template.json"), JSON.stringify({generator: manifest.name, version: manifest.version, preset: "chat", bun: Bun.version, shadcn: "4.22.1", registry: registry.items, status: "candidate-unreleased"}, null, 2)+"\n");
    await configureProject(output, {icons: false});
    return output;
  } catch (error) {
    await rm(output, {recursive: true, force: true});
    throw error;
  }
}
