#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { $ } from "bun";

const root = resolve(import.meta.dirname, "..");
const triple = (await $`rustc -vV`.text()).match(/^host: (.+)$/m)?.[1].trim();
const targets: Record<string, { platform: string; exe: string }> = {
  "aarch64-apple-darwin": { platform: "darwin-arm64", exe: "" },
  "x86_64-pc-windows-msvc": { platform: "win32-x64", exe: ".exe" },
};
if (!triple || !targets[triple]) throw new Error(`Unsupported signature verification target: ${triple}`);
const target = targets[triple];
const helpers = target.exe ? ["codex-windows-sandbox-setup", "codex-command-runner"] : [];
const bundle = process.argv[2];
for (const name of ["codex", "codex-code-mode-host", ...helpers]) {
  const original = join(root, `node_modules/@openai/codex-${target.platform}/vendor`, triple, helpers.includes(name) ? "codex-resources" : "bin", `${name}${target.exe}`);
  const staged = bundle ? join(resolve(bundle), target.exe ? "" : "Contents/MacOS", `${name}${target.exe}`) : join(root, "src-tauri/binaries", `${name}-${triple}${target.exe}`);
  const hash = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
  if (hash(original) !== hash(staged)) throw new Error(`${name}: vendor bytes or signature changed during staging/bundling`);
  if (!target.exe) await $`codesign --verify --strict ${staged}`.quiet();
}
console.log("PASS: Codex and code-mode host retain their original vendor bytes and signatures");
