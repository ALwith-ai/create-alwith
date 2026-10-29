import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, relative } from "node:path";
import { createHash } from "node:crypto";
import { configureProject, safePath, validateConfig, type AppConfig } from "./config";
import { authMode, configureAuth, type AuthMode } from "./auth";
import { configureLockfiles } from "./lockfiles";
import { generateUpdaterKeys, githubRepository, updaterKeyDirectory, writeUpdaterKeys } from "./updates";
import { GenerateError, generationError } from "./errors";
export { GenerateError, type GenerateErrorCode } from "./errors";
export { generateUpdaterKeys, githubRepository, updaterKeyDirectory, writeUpdaterKeys, type UpdaterKeys } from "./updates";

const packageRoot = resolve(import.meta.dirname, "..");
export type GeneratePhase = "validate" | "template" | "registry" | "configure" | "complete";
/** Auto update through the app's own GitHub Releases; a fresh signing key is written outside the project. */
export interface UpdateOptions {
  /** `owner/repo` that will host the releases and `latest.json`. */
  github: string;
  /** Reuse an existing public key instead of generating a key pair. */
  pubkey?: string;
  /** Password protecting the generated private key; empty leaves it unprotected. */
  keyPassword?: string;
  /** Where `<name>.key` and `<name>.key.pub` are written; defaults to `~/.tauri`. */
  keyDirectory?: string;
}
export interface GenerateOptions {
  directory: string; name: string; productName: string; identifier: string;
  auth?: AuthMode;
  updates?: UpdateOptions;
  signal?: AbortSignal;
  onProgress?: (phase: GeneratePhase) => void;
}
export interface GenerateResult {
  directory: string;
  /** Present when updates were configured: the repository and the private key file to keep as a CI secret. */
  updates?: {github: string; privateKey?: string};
}
/** Offline template expansion. Package installation and native builds are separate steps. */
export async function generateProject(options: GenerateOptions): Promise<string> {
  return (await generateProjectWithResult(options)).directory;
}

/** Like `generateProject`, also reporting where the updater private key was written. */
export async function generateProjectWithResult(options: GenerateOptions): Promise<GenerateResult> {
  const progress = (phase: GeneratePhase) => {
    if (options.signal?.aborted) throw new GenerateError("CANCELLED", "Generation cancelled");
    options.onProgress?.(phase);
    if (options.signal?.aborted) throw new GenerateError("CANCELLED", "Generation cancelled");
  };
  progress("validate");
  const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  let config: AppConfig;
  let auth: AuthMode;
  let keys: {directory: string; pair: ReturnType<typeof generateUpdaterKeys>} | undefined;
  let updates: {github: string; pubkey: string} | undefined;
  try {
    auth = authMode(options.auth ?? "alwith");
    if (options.updates) {
      const github = githubRepository(options.updates.github);
      if (options.updates.pubkey) updates = {github, pubkey: options.updates.pubkey.trim()};
      else {
        const directory = options.updates.keyDirectory ?? updaterKeyDirectory();
        if (await Bun.file(join(directory, `${options.name}.key`)).exists()) throw new Error(`An updater key already exists at ${join(directory, `${options.name}.key`)}; move it away or pass its public key with --pubkey`);
        keys = {directory, pair: generateUpdaterKeys(options.updates.keyPassword ?? "")};
        updates = {github, pubkey: keys.pair.pubkey};
      }
    }
    config = validateConfig({name: options.name, productName: options.productName, identifier: options.identifier, version: "0.1.0", icon: "assets/icon.svg", languages: ["en", "zh-CN"], window: {width: 1200, height: 800, minWidth: 900, minHeight: 600}, preset: "chat", modules: auth === "alwith" ? ["chat", "auth", "store"] : ["chat", "store"], ...(updates ? {updates} : {}), template: {name: "create-alwith", version: manifest.version}});
    if (!options.directory) throw new Error("An output directory is required");
  } catch (error) {
    throw new GenerateError("INVALID_INPUT", error instanceof Error ? error.message : String(error), {cause: error});
  }
  const output = resolve(options.directory);
  let privateKey: string | undefined;
  await mkdir(dirname(output), {recursive: true});
  // Exclusive creation: never overwrite an existing project or a symlink.
  try { await mkdir(output); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new GenerateError("DIRECTORY_EXISTS", `Output directory already exists: ${output}`, {cause: error});
    throw generationError(error);
  }
  try {
    progress("template");
    await cp(join(packageRoot, "template"), output, {recursive: true});
    await cp(join(packageRoot, "alwith.app.schema.json"), join(output, "alwith.app.schema.json"));
    const registry = JSON.parse(await readFile(join(packageRoot, "registry/built/manifest.json"), "utf8")) as {items: Array<{name: string; sha256: string}>};
    if (auth === "none") registry.items = registry.items.filter(item => item.name !== "login");
    progress("registry");
    const blockSources = new Map<string, string>();
    for (const item of registry.items) {
      const bytes = await readFile(safePath(join(packageRoot, "registry/built"), `${item.name}.json`));
      if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new GenerateError("SNAPSHOT_INVALID", `Registry snapshot integrity failed: ${item.name}`);
      const block = JSON.parse(bytes.toString()) as {files: Array<{target: string; content: string}>};
      for (const file of block.files) {
        const destination = safePath(output, file.target);
        await mkdir(dirname(destination), {recursive: true});
        await writeFile(destination, file.content, {flag: "wx"});
        blockSources.set(file.target, `registry/${item.name}`);
      }
    }
    await configureAuth(output, auth);
    if (auth === "none") {
      await cp(join(packageRoot, "locks/none/bun.lock"), join(output, "bun.lock"));
      await cp(join(packageRoot, "locks/none/src-tauri/Cargo.lock"), join(output, "src-tauri/Cargo.lock"));
    }
    await writeFile(join(output, "alwith.app.json"), JSON.stringify({$schema: "./alwith.app.schema.json", ...config}, null, 2)+"\n");
    progress("configure");
    // The private key lives outside the project (never committed); only its public half enters alwith.app.json.
    if (keys) privateKey = await writeUpdaterKeys(keys.directory, config.name, keys.pair);
    const templateManifest = JSON.parse(await readFile(join(output, "package.json"), "utf8"));
    await configureProject(output, {icons: false});
    await configureLockfiles(output, templateManifest.name, config.name, config.version);
    const files: Array<{path: string; owner: "generator" | "user"; source: string; sha256: string}> = [];
    async function record(directory: string): Promise<void> {
      for (const entry of (await readdir(directory, {withFileTypes: true})).sort((a, b) => a.name < b.name ? -1 : 1)) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await record(path);
        else {
          const name = relative(output, path).replaceAll("\\", "/");
          const derived = ["index.html", "src-tauri/tauri.conf.json", "src/generated/app-icon.ts"].includes(name) || name.startsWith("public/app-icon.");
          files.push({path: name, owner: derived ? "generator" : "user", source: derived ? "alwith.app.json" : blockSources.get(name) ?? (name === "alwith.app.json" ? "input" : "template"), sha256: createHash("sha256").update(await readFile(path)).digest("hex")});
        }
      }
    }
    await record(output);
    await mkdir(join(output, ".alwith"));
    await writeFile(join(output, ".alwith/template.json"), JSON.stringify({generator: manifest.name, version: manifest.version, preset: "chat", auth, updates: updates ? {github: updates.github} : null, bun: Bun.version, shadcn: "4.22.1", registry: registry.items, files, generatedFields: {"package.json": ["name", "version"], "src-tauri/Cargo.toml": ["package.name", "package.version", "bin.name"]}}, null, 2)+"\n");
    progress("complete");
    return {directory: output, ...(updates ? {updates: {github: updates.github, ...(privateKey ? {privateKey} : {})}} : {})};
  } catch (error) {
    await rm(output, {recursive: true, force: true});
    if (privateKey) await rm(privateKey, {force: true}).then(() => rm(`${privateKey}.pub`, {force: true}));
    throw generationError(error);
  }
}
