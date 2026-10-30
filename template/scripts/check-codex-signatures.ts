#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { $ } from "bun";

const root = resolve(import.meta.dirname, "..");
const triple = (await $`rustc -vV`.text()).match(/^host: (.+)$/m)?.[1].trim();
if (triple !== "aarch64-apple-darwin") throw new Error(`Unsupported signature verification target: ${triple}`);
const bundle = process.argv[2];
for (const name of ["codex", "codex-code-mode-host"]) {
  const original = join(root, "node_modules/@openai/codex-darwin-arm64/vendor", triple, "bin", name);
  const staged = bundle ? join(resolve(bundle), "Contents/MacOS", name) : join(root, "src-tauri/binaries", `${name}-${triple}`);
  const hash = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
  if (hash(original) !== hash(staged)) throw new Error(`${name}: vendor bytes or signature changed during staging/bundling`);
  await $`codesign --verify --strict ${staged}`.quiet();
}
console.log("PASS: Codex and code-mode host retain their original vendor bytes and signatures");
