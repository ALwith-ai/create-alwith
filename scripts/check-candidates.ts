import { generateProject } from "../src/generate";
import { mkdtemp, mkdir, rm, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
const [authArchive, shellArchive] = process.argv.slice(2);
if (!authArchive || !shellArchive || process.argv.length !== 4) {
  throw new Error(
    "Usage: bun scripts/check-candidates.ts <auth.tgz> <desktop-shell.tgz>",
  );
}
const archives = { auth: resolve(authArchive), shell: resolve(shellArchive) };
for (const path of Object.values(archives)) {
  if (!(await Bun.file(path).exists()))
    throw new Error(`Candidate archive missing: ${path}`);
}
// Keep the isolated consumers for native UI inspection after the build checks.
const root = await mkdtemp(join(tmpdir(), "alwith-candidate-consumers-"));
console.log(root);
async function run(cwd: string, args: string[]) {
  console.log(`[${cwd}] ${args.join(" ")}`);
  const child = Bun.spawn(args, {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, CARGO_NET_RETRY: "0" },
  });
  const code = await child.exited;
  if (code !== 0)
    throw new Error(`Command failed (${code}): ${args.join(" ")}`);
}
for (const auth of ["none", "alwith"] as const) {
  const dir = join(root, auth);
  await generateProject({
    directory: dir,
    name: `candidate-${auth}`,
    productName: `Candidate ${auth}`,
    identifier: `dev.alwith.candidate.${auth}`,
    auth,
  });
  await run(dir, [
    process.execPath,
    "install",
    "--frozen-lockfile",
    "--offline",
  ]);
  const originals = await Promise.all(
    ["package.json", "bun.lock"].map((p) => readFile(join(dir, p), "utf8")),
  );
  for (const [name, archive] of [
    ["module-desktop-shell", archives.shell],
    ...(auth === "alwith" ? [["module-auth", archives.auth]] : []),
  ]) {
    const target = join(dir, "node_modules/@alwith", name);
    await rm(target, { recursive: true, force: true });
    await mkdir(target, { recursive: true });
    await run(dir, [
      "tar",
      "-xzf",
      archive,
      "--strip-components=1",
      "-C",
      target,
    ]);
  }
  await run(dir, [process.execPath, "run", "app-config"]);
  await run(dir, [process.execPath, "run", "check"]);
  await run(dir, [process.execPath, "run", "build"]);
  await run(dir, [process.execPath, "run", "stage"]);
  await run(join(dir, "src-tauri"), ["cargo", "check", "--offline"]);
  await run(dir, [process.execPath, "run", "check:independence"]);
  const current = await Promise.all(
    ["package.json", "bun.lock"].map((p) => readFile(join(dir, p), "utf8")),
  );
  if (JSON.stringify(originals) !== JSON.stringify(current))
    throw new Error("Validation changed production dependencies");
  console.log(`PASS ${auth}`);
}
console.log(`PASS both candidate consumers: ${root}`);
