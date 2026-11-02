import { fileURLToPath } from "node:url";
import { configureProject } from "@alwith/module-desktop-shell/build";
await configureProject(fileURLToPath(new URL("..", import.meta.url)), { icons: false });
