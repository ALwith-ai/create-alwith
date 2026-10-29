#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import type { AuthMode } from "./auth";
import { generateProjectWithResult } from "./generate";
import { GenerateError, generationError } from "./errors";

/** Reads a line without echo for the key password; falls back to a plain question outside a terminal. */
async function askHidden(question: string, signal: AbortSignal): Promise<string> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    const prompt = createInterface({input: process.stdin, output: process.stdout});
    try { return (await prompt.question(question, {signal})).trim(); } finally { prompt.close(); }
  }
  process.stdout.write(question);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise<string>((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      signal.removeEventListener("abort", onAbort);
      process.stdout.write("\n");
      if (error) reject(error); else resolve(value);
    };
    const onAbort = () => finish(Object.assign(new Error("Generation cancelled"), {name: "AbortError"}));
    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\u0003") return onAbort();
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    };
    signal.addEventListener("abort", onAbort, {once: true});
    process.stdin.on("data", onData);
  });
}

const controller = new AbortController();
const cancel = () => controller.abort();
process.once("SIGINT", cancel);
process.once("SIGTERM", cancel);
let machine = Bun.argv.slice(2).includes("--json");
try {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({args: Bun.argv.slice(2), allowPositionals: true, options: {
      directory: {type: "string"}, name: {type: "string"}, "product-name": {type: "string"},
      identifier: {type: "string"}, auth: {type: "string"}, preset: {type: "string"}, yes: {type: "boolean"},
      github: {type: "string"}, "key-password": {type: "string"}, pubkey: {type: "string"},
      json: {type: "boolean"}, help: {type: "boolean"},
    }});
  } catch (error) { throw new GenerateError("INVALID_INPUT", error instanceof Error ? error.message : String(error)); }
  const {values, positionals} = parsed;
  machine = values.json === true;
  if (values.help) {
    console.log("bun create alwith <dir> --name my-app --product-name 'My App' --identifier com.example.myapp --preset chat --auth alwith|none [--github owner/repo [--key-password <password> | --pubkey <key>]] --yes [--json]\nOmit arguments in an interactive terminal to be prompted. --directory is an alias for <dir>.\n--github turns on signed auto update through that repository's GitHub Releases: a new updater key pair is written to ~/.tauri/<name>.key (never into the project) unless --pubkey reuses an existing public key.");
  } else {
    if (positionals.length > 1 || (positionals.length && values.directory)) throw new GenerateError("INVALID_INPUT", "Provide one output directory, either positional or --directory");
    if (values.preset && values.preset !== "chat") throw new GenerateError("INVALID_INPUT", "Only the chat preset is available");
    const fields = {
      directory: (values.directory ?? positionals[0]) as string | undefined,
      name: values.name as string | undefined,
      productName: values["product-name"] as string | undefined,
      identifier: values.identifier as string | undefined,
      auth: values.auth as string | undefined,
    };
    if (!values.yes && !machine && process.stdin.isTTY && Object.values(fields).some(v => !v)) {
      const prompt = createInterface({input: process.stdin, output: process.stdout});
      try {
        for (const [key, question] of Object.entries({directory: "Output directory", name: "Package name", productName: "Application name", identifier: "Bundle identifier (e.g. com.example.myapp)", auth: "ALwith account with pets, or bare chat (alwith/none)"})) {
          const field = key as keyof typeof fields;
          if (!fields[field]) fields[field] = (await prompt.question(`${question}: `, {signal: controller.signal})).trim();
        }
      } finally { prompt.close(); }
    }
    if (Object.values(fields).some(v => !v)) throw new GenerateError("INVALID_INPUT", "Provide directory, --name, --product-name --identifier and --auth alwith|none. Use --help for an example.");
    const interactive = !values.yes && !machine && process.stdin.isTTY;
    let github = values.github as string | undefined;
    let keyPassword = values["key-password"] as string | undefined;
    if (github === undefined && interactive) {
      const prompt = createInterface({input: process.stdin, output: process.stdout});
      try { github = (await prompt.question("GitHub repository for releases and auto update (owner/repo, blank for none): ", {signal: controller.signal})).trim(); } finally { prompt.close(); }
    }
    if (github && !values.pubkey && keyPassword === undefined && interactive)
      keyPassword = await askHidden("Password for the new update signing key (blank for none): ", controller.signal);
    if (!github && (values.pubkey || keyPassword !== undefined)) throw new GenerateError("INVALID_INPUT", "--pubkey and --key-password need --github");
    const result = await generateProjectWithResult({
      directory: fields.directory!, name: fields.name!, productName: fields.productName!, identifier: fields.identifier!, auth: fields.auth as AuthMode,
      ...(github ? {updates: {github, pubkey: values.pubkey as string | undefined, keyPassword}} : {}),
      signal: controller.signal,
      onProgress: phase => { if (machine) console.log(JSON.stringify({type: "progress", phase})); },
    });
    const next = ["bun install", "bun run app-config", "bun run dev:tauri"];
    const updates = result.updates && [
      `Auto update publishes through https://github.com/${result.updates.github}/releases; the updater reads releases/latest/download/latest.json.`,
      ...(result.updates.privateKey ? [
        `Updater private key: ${result.updates.privateKey} (kept outside the project; back it up, every future release must be signed with it).`,
        keyPassword ? "The key is protected by the password you entered." : "The key has no password; TAURI_SIGNING_PRIVATE_KEY_PASSWORD stays empty.",
      ] : ["Releases are signed with the private key matching the public key you passed."]),
      "Repository secrets for .github/workflows/release.yml: APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD, APPLE_SIGNING_IDENTITY, APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID, TAURI_SIGNING_PRIVATE_KEY (the key file's contents), TAURI_SIGNING_PRIVATE_KEY_PASSWORD. Push a v<version> tag to release.",
    ];
    console.log(machine ? JSON.stringify({type: "result", ok: true, directory: result.directory, next, ...(result.updates ? {updates: result.updates} : {})}) : `Created ${result.directory}.\nIn that directory, run:\n${next.join("\n")}${updates ? `\n\n${updates.join("\n")}` : ""}`);
  }
} catch (cause) {
  const error = generationError(cause);
  if (machine) console.log(JSON.stringify({type: "result", ok: false, error: {code: error.code, message: error.message}}));
  else console.error(`${error.code}: ${error.message}`);
  process.exitCode = error.code === "CANCELLED" ? 130 : 1;
} finally {
  process.removeListener("SIGINT", cancel);
  process.removeListener("SIGTERM", cancel);
}
