import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { join, resolve, extname, sep } from "node:path";
import { desktopWindow } from "@alwith/module-desktop-shell/config";

export interface AppConfig {
  name: string; productName: string; identifier: string; version: string; icon: string;
  languages: string[]; window: {width: number; height: number; minWidth: number; minHeight: number};
  preset: "chat"; modules: string[]; template: {name: "create-alwith"; version: string};
}
export function validateConfig(value: unknown): AppConfig {
  const c = value as AppConfig;
  if (!c || !/^[a-z][a-z0-9-]{0,213}$/.test(c.name ?? "")) throw new Error("name must be a lowercase npm package name");
  if (typeof c.productName !== "string" || !c.productName.trim() || /[\x00-\x1f/\\]/.test(c.productName)) throw new Error("productName must be a nonempty application name");
  if (!/^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z][A-Za-z0-9-]*){2,}$/.test(c.identifier ?? "")) throw new Error("identifier must be an explicit reverse-DNS bundle ID");
  if (!/^\d+\.\d+\.\d+$/.test(c.version ?? "")) throw new Error("version must have three numeric components");
  if (c.preset !== "chat") throw new Error("Only the chat preset is available");
  if (!Array.isArray(c.languages) || !c.languages.length || c.languages.some(l => !["en", "zh-CN"].includes(l))) throw new Error("Supported languages are en and zh-CN");
  if (!Array.isArray(c.modules) || !["chat", "auth", "store"].every(m => c.modules.includes(m))) throw new Error("The chat preset requires chat, auth and store");
  for (const key of ["width", "height", "minWidth", "minHeight"] as const) if (!Number.isInteger(c.window?.[key]) || c.window[key] <= 0) throw new Error(`window.${key} must be positive`);
  if (c.window.minWidth > c.window.width || c.window.minHeight > c.window.height) throw new Error("Minimum window dimensions must not exceed initial dimensions");
  safePath("/app", c.icon);
  return c;
}
export function safePath(root: string, relative: string): string {
  if (typeof relative !== "string" || !relative || relative.includes("\\") || relative.startsWith("/")) throw new Error("Expected a relative project path");
  const path = resolve(root, relative);
  if (!path.startsWith(resolve(root) + sep)) throw new Error(`Path escapes the project: ${relative}`);
  return path;
}
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const html = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** Regenerates only the documented configuration files from alwith.app.json. */
export async function configureProject(root: string, options: {icons?: boolean} = {}): Promise<void> {
  const c = validateConfig(JSON.parse(await readFile(join(root, "alwith.app.json"), "utf8")));
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  manifest.name = c.name; manifest.version = c.version;
  await writeFile(join(root, "package.json"), json(manifest));
  let cargo = await readFile(join(root, "src-tauri/Cargo.toml"), "utf8");
  cargo = cargo.replace(/(\[package\]\s*\nname = )[^\n]+/, `$1${JSON.stringify(c.name)}`)
    .replace(/(\[package\][\s\S]*?\nversion = )[^\n]+/, `$1${JSON.stringify(c.version)}`)
    .replace(/(\[\[bin\]\]\s*\nname = )[^\n]+/, `$1${JSON.stringify(c.name)}`);
  await writeFile(join(root, "src-tauri/Cargo.toml"), cargo);
  await writeFile(join(root, "index.html"), `<!doctype html>\n<html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${html(c.productName)}</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n`);
  const iconName = `app-icon${extname(c.icon)}`;
  await mkdir(join(root, "public"), {recursive: true});
  await copyFile(safePath(root, c.icon), join(root, "public", iconName));
  await mkdir(join(root, "src/generated"), {recursive: true});
  await writeFile(join(root, "src/generated/app-icon.ts"), `// Generated from alwith.app.json.\nexport default ${JSON.stringify('/'+iconName)};\n`);
  const config = {$schema: "https://schema.tauri.app/config/3.0.0-alpha.3", productName: c.productName, mainBinaryName: c.name, version: c.version, identifier: c.identifier,
    build: {frontendDist: "../dist", devUrl: "http://localhost:1420", beforeDevCommand: "bun run stage && bun run dev", beforeBuildCommand: "bun run stage && bun run build"},
    app: {windows: [desktopWindow(c)], security: {csp: null}},
    bundle: {active: true, category: "Productivity", targets: ["app", "dmg"], externalBin: ["binaries/alwith-runtime", "binaries/bun", "binaries/codex", "binaries/codex-code-mode-host"], resources: {"resources/adapter": "adapter", "resources/native": "native", "resources/licenses": "licenses"}, icon: ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"], macOS: {minimumSystemVersion: "26.0", entitlements: "./Entitlements.plist"}}};
  await writeFile(join(root, "src-tauri/tauri.conf.json"), json(config));
  if (options.icons !== false) {
    const process = Bun.spawn(["bun", "run", "tauri", "icon", c.icon, "-o", "src-tauri/icons"], {cwd: root, stdout: "inherit", stderr: "inherit"});
    if (await process.exited !== 0) throw new Error("Icon generation failed");
  }
}
