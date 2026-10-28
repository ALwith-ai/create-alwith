import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = resolve(import.meta.dirname, "..");
const json = async (path: string) => JSON.parse(await readFile(resolve(root, path), "utf8"));
for (const path of ["package.json", "template/package.json"]) {
  const pkg = await json(path);
  assert(!pkg.overrides, `${path}: overrides are local-only`);
  for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
    for (const [name, range] of Object.entries(pkg[section] ?? {})) {
      assert(!/^(file:|link:|workspace:|github:|git\+|\/)/.test(String(range)), `${name}: registry dependency required`);
    }
  }
}
const source = await json("registry.json");
const manifest = await json("registry/built/manifest.json");
assert.deepEqual(manifest.items.map((i: any) => i.name).sort(), source.items.map((i: any) => i.name).sort());
const targets = new Set<string>();
for (const item of manifest.items) {
  assert(/^[a-z-]+$/.test(item.name));
  const raw = await readFile(resolve(root, `registry/built/${item.name}.json`));
  assert.equal(createHash("sha256").update(raw).digest("hex"), item.sha256);
  const block = JSON.parse(raw.toString());
  const definition = source.items.find((i: any) => i.name === item.name);
  assert.equal(block.files.length, definition.files.length);
  for (const file of block.files) {
    const target = relative(resolve(root, "template"), resolve(root, "template", file.target));
    assert(target && !target.startsWith("..") && !isAbsolute(target), `unsafe target ${file.target}`);
    assert(!targets.has(target), `duplicate target ${target}`);
    targets.add(target);
    const original = definition.files.find((f: any) => f.target === file.target);
    assert(original, `unexpected target ${target}`);
    assert.equal(file.content, await readFile(resolve(root, original.path), "utf8"), `stale block ${item.name}`);
  }
}
async function scan(dir: string): Promise<void> {
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    if (["node_modules", ".git"].includes(entry.name)) continue;
    const path = resolve(dir, entry.name);
    assert(!entry.isSymbolicLink(), `unexpected symlink ${path}`);
    if (entry.isDirectory()) await scan(path);
    else {
      const text = await readFile(path, "utf8");
      assert(!/\/(?:Users|private\/tmp)\//.test(text), `local path in ${relative(root, path)}`);
      assert(!/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(text), `private key in ${relative(root, path)}`);
    }
  }
}
await scan(root);
console.log(`Source checks passed: ${manifest.items.length} registry blocks, ${targets.size} page files.`);
