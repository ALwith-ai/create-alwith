import { configureProject } from "@alwith/module-desktop-shell/build";
await configureProject(new URL("..", import.meta.url).pathname);
