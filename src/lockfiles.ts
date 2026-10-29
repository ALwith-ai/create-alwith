import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Change only the generated root package identity; preserve the verified dependency closure. */
export async function configureLockfiles(root: string, previousName: string, name: string, version: string): Promise<void> {
  const bunPath = join(root, "bun.lock");
  const bun = await readFile(bunPath, "utf8");
  const rootName = /("workspaces"\s*:\s*\{\s*""\s*:\s*\{\s*"name"\s*:\s*)"[^"]+"/;
  if (!rootName.test(bun)) throw new Error("Template Bun lockfile has no root workspace");
  await writeFile(bunPath, bun.replace(rootName, (_, prefix) => prefix + JSON.stringify(name)));
  const cargoPath = join(root, "src-tauri/Cargo.lock");
  const cargo = await readFile(cargoPath, "utf8");
  const packages = cargo.split(/(?=^\[\[package\]\])/m);
  let changed = 0;
  const updated = packages.map(block => {
    if (!block.startsWith("[[package]]") || !block.includes(`\nname = ${JSON.stringify(previousName)}\n`)) return block;
    if (/^source\s*=/m.test(block)) throw new Error("Template root package unexpectedly has a registry source");
    changed++;
    return block.replace(/^name = .*$/m, `name = ${JSON.stringify(name)}`).replace(/^version = .*$/m, `version = ${JSON.stringify(version)}`);
  });
  if (changed !== 1) throw new Error("Template Cargo lockfile must contain exactly one root package");
  const header = updated.shift()!;
  const rootIndex = updated.findIndex(block => block.includes(`\nname = ${JSON.stringify(name)}\n`) && !/^source\s*=/m.test(block));
  const [rootPackage] = updated.splice(rootIndex, 1);
  const insertion = updated.findIndex(block => (block.match(/^name = "([^"]+)"/m)?.[1] ?? "") >= name);
  updated.splice(insertion < 0 ? updated.length : insertion, 0, rootPackage);
  await writeFile(cargoPath, header + updated.join(""));
}
