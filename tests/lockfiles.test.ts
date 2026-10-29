import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateProject } from "../src/generate";

test("new brand identities preserve the frozen dependency closure", async () => {
  const root = await mkdtemp(join(tmpdir(), "create-locks-"));
  try {
    for (const name of ["aaa-buddy", "zzz-buddy"]) {
      const output = await generateProject({directory: join(root, name), name, productName: name, identifier: "com.example.buddy"});
      const bun = await readFile(join(output, "bun.lock"), "utf8");
      expect(bun).toContain(`"name": "${name}"`);
      const cargo = await readFile(join(output, "src-tauri/Cargo.lock"), "utf8");
      const records = cargo.split(/(?=^\[\[package\]\])/m).slice(1);
      const before = (await readFile(new URL("../template/src-tauri/Cargo.lock", import.meta.url), "utf8")).split(/(?=^\[\[package\]\])/m).slice(1);
      expect(records.filter(block => block.includes(`\nname = "${name}"\n`))).toHaveLength(1);
      expect(records.filter(block => !block.includes(`\nname = "${name}"\n`))).toEqual(before.filter(block => !block.includes('\nname = "alwith-app"\n')));
    }
  } finally { await rm(root, {recursive: true, force: true}); }
});
