import { cp } from "node:fs/promises";
import { relative } from "node:path";

// Development and build state must never become part of a generated application.
const excluded = new Set(["node_modules", "target", "dist", ".git", ".cache", ".vite", ".DS_Store"]);
export async function copyTemplate(source: string, destination: string): Promise<void> {
  await cp(source, destination, {
    recursive: true,
    filter: path => {
      const name = relative(source, path).replaceAll("\\", "/");
      return !name.split("/").some(part => excluded.has(part))
        && !["src-tauri/binaries", "src-tauri/resources", "src-tauri/gen"].some(dir => name === dir || name.startsWith(`${dir}/`));
    },
  });
}
