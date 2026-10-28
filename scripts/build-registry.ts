import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const child = Bun.spawn(["bunx", "--bun", "shadcn@4.22.1", "build", "--output", "registry/built"], {stdout: "inherit", stderr: "inherit"});
if (await child.exited !== 0) throw new Error("Registry build failed");
const source = JSON.parse(await readFile("registry.json", "utf8"));
const items = await Promise.all(source.items.map(async (item: {name: string}) => ({name: item.name, sha256: createHash("sha256").update(await readFile(`registry/built/${item.name}.json`)).digest("hex")})));
await writeFile("registry/built/manifest.json", JSON.stringify({items}, null, 2)+"\n");
