#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { generateProject } from "./generate";
import { GenerateError, generationError } from "./errors";

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
      identifier: {type: "string"}, preset: {type: "string"}, yes: {type: "boolean"},
      json: {type: "boolean"}, help: {type: "boolean"},
    }});
  } catch (error) { throw new GenerateError("INVALID_INPUT", error instanceof Error ? error.message : String(error)); }
  const {values, positionals} = parsed;
  machine = values.json === true;
  if (values.help) {
    console.log("bun create alwith <dir> --name my-app --product-name 'My App' --identifier com.example.myapp --preset chat --yes [--json]\nOmit arguments in an interactive terminal to be prompted. --directory is an alias for <dir>.");
  } else {
    if (positionals.length > 1 || (positionals.length && values.directory)) throw new GenerateError("INVALID_INPUT", "Provide one output directory, either positional or --directory");
    if (values.preset && values.preset !== "chat") throw new GenerateError("INVALID_INPUT", "Only the chat preset is available");
    const fields = {
      directory: (values.directory ?? positionals[0]) as string | undefined,
      name: values.name as string | undefined,
      productName: values["product-name"] as string | undefined,
      identifier: values.identifier as string | undefined,
    };
    if (!values.yes && !machine && process.stdin.isTTY && Object.values(fields).some(v => !v)) {
      const prompt = createInterface({input: process.stdin, output: process.stdout});
      try {
        for (const [key, question] of Object.entries({directory: "Output directory", name: "Package name", productName: "Application name", identifier: "Bundle identifier (e.g. com.example.myapp)"})) {
          const field = key as keyof typeof fields;
          if (!fields[field]) fields[field] = (await prompt.question(`${question}: `, {signal: controller.signal})).trim();
        }
      } finally { prompt.close(); }
    }
    if (Object.values(fields).some(v => !v)) throw new GenerateError("INVALID_INPUT", "Provide directory, --name, --product-name and --identifier. Use --help for an example.");
    const output = await generateProject({
      directory: fields.directory!, name: fields.name!, productName: fields.productName!, identifier: fields.identifier!,
      signal: controller.signal,
      onProgress: phase => { if (machine) console.log(JSON.stringify({type: "progress", phase})); },
    });
    const next = ["bun install", "bun run app-config", "bun run dev:tauri"];
    console.log(machine ? JSON.stringify({type: "result", ok: true, directory: output, next}) : `Created ${output}.\nIn that directory, run:\n${next.join("\n")}`);
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
