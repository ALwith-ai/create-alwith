#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { codexArtifact } from "@alwith/module-chat/stage";
import { $ } from "bun";

const root = resolve(import.meta.dirname, "..");
const triple = (await $`rustc -vV`.text()).match(/^host: (.+)$/m)?.[1].trim();
if (!triple) throw new Error("rustc -vV did not report a host triple");
// The originals are the Codex build of the chat engine, as scripts/stage.ts staged them.
const codex = codexArtifact(triple);
const bundle = process.argv[2];
for (const { name, source: original } of codex.files) {
  const staged = bundle ? join(resolve(bundle), codex.exe ? "" : "Contents/MacOS", `${name}${codex.exe}`) : join(root, "src-tauri/binaries", `${name}-${triple}${codex.exe}`);
  const hash = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
  if (hash(original) !== hash(staged)) throw new Error(`${name}: vendor bytes or signature changed during staging/bundling`);
  if (!codex.exe) await $`codesign --verify --strict ${staged}`.quiet();
}
console.log("PASS: Codex and code-mode host retain their original vendor bytes and signatures");
