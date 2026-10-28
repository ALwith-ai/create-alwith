#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { generateProject } from "./generate";
const {values} = parseArgs({args: Bun.argv.slice(2), options: {directory: {type: "string"}, name: {type: "string"}, "product-name": {type: "string"}, identifier: {type: "string"}, help: {type: "boolean"}}});
if (values.help) {
  console.log("bun create alwith --directory ./my-app --name my-app --product-name 'My App' --identifier com.example.myapp");
} else {
  try {
    if (!values.directory || !values.name || !values['product-name'] || !values.identifier) throw new Error("Provide --directory, --name, --product-name and --identifier. Use --help for an example.");
    const output = await generateProject({directory: values.directory, name: values.name, productName: values['product-name'], identifier: values.identifier});
    console.log(`Created ${output}. Install dependencies, then run bun run app-config and bun run dev:tauri.`);
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
