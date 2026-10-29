import { readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

export type AuthMode = "alwith" | "none";
export function authMode(value: unknown): AuthMode {
  if (value !== "alwith" && value !== "none") throw new Error("auth must be alwith or none");
  return value;
}

/** Remove account wiring at generation time, not at runtime behind a hidden login. */
export async function configureAuth(root: string, mode: AuthMode): Promise<void> {
  if (mode === "alwith") return;
  const edit = async (path: string, change: (source: string) => string) => {
    const file = join(root, path);
    await writeFile(file, change(await readFile(file, "utf8")));
  };
  await rm(join(root, "src/auth"), {recursive: true, force: true});
  for (const file of ["vibemon.html", "vibemon-bubble.html", "src/vibemon.tsx", "src/vibemon-bubble.tsx"]) await rm(join(root, file), {force: true});
  await edit("src/App.tsx", source => source
    .replace(/^import .* from "(?:@alwith\/module-auth[^"]*|\.\/auth\/pets)"\n/gm, "")
    .replace(/^  const \[(pets|petsReady),.*\n/gm, "")
    .replace(/^    setPets\(false\)\n/gm, "")
    .replace(/  useEffect\(\(\) => \{\n    let active = true[\s\S]*?\n  async function newChat/, "  async function newChat")
    .replace('onSettings={() => { setPets(false); setSettings(true) }} onPets={() => {setSettings(false); setPets(true)}} petsReady={petsReady}', 'onSettings={() => setSettings(true)}')
    .replace('pets && petsReady ? <PetCenter /> : settings', 'settings')
    .replace(/^      \{petsReady && <PetLounge.*\n/m, ""));
  await edit("src/i18n.ts", source => source.replace(/^import .*vibemonLocales.*\n/m, "").replace(/^for \(const language.*vibemonLocales.*\n/m, ""));
  await edit("src/index.css", source => source.split("\n").filter(line => !line.includes("module-auth")).join("\n"));
  await edit("package.json", source => {
    const manifest = JSON.parse(source);
    for (const name of ["@alwith/module-auth", "@alwith/native-auth", "@alwith/native-kit", "@tauri-apps/plugin-http", "@tauri-apps/plugin-os", "@tauri-apps/plugin-log"]) delete manifest.dependencies[name];
    return JSON.stringify(manifest, null, 2) + "\n";
  });
  await edit("src/main.tsx", source => source
    .replace(/^import .* from "\.\/auth\/.*"\n/gm, "")
    .replace(/^void initPlatformAuth\(\)\n/m, "")
    .replace(/    <AuthGate>\n      <App \/>\n    <\/AuthGate>/, "    <App />"));
  await edit("src/settings/page.tsx", source => source
    .replace(/^import \{ logoutPlatform, usePlatformAuth \}.*\n/m, "")
    .replace(/^  const account = .*\n/m, "")
    .replace(/  async function signOut\(\) \{[\s\S]*?\n  \}\n/, "")
    .replace(/      <div className="flex items-center justify-between gap-4">\n        <div className="min-w-0">[\s\S]*?^      <\/div>\n/m, "")
    .replace(/^import \{ useState \}.*\n/m, "")
    .replace(", LogOutIcon", "")
    .replace(/^import \{ Alert, AlertDescription \}.*\n/m, "")
    .replace(/^  const \[(error|busy),.*\n/gm, "")
    .replace(/^      \{error &&.*\n/m, ""));
  await edit("src/layout/navigation.tsx", source => source
    .replace(/^import \{ logoutPlatform, usePlatformAuth \}.*\n/m, "")
    .replace(/^  const email = .*\n/m, "")
    .replace("PawPrintIcon, LogOutIcon, ", "")
    .replace("onSelect, onSettings, onPets, petsReady }", "onSelect, onSettings }")
    .replace(/^  (onPets|petsReady):.*\n/gm, "")
    .replace(/^        <Button.*onClick=\{onPets\}.*\n/m, "")
    .replace('email ?? t("settings")', 't("settings")')
    .replace(/          <Button[^\n]*logoutPlatform[\s\S]*?<\/Button>\n/, ""));
  await edit("src-tauri/Cargo.toml", source => source.replace(/^(alwith-auth-client|alwith-native-client|tauri-plugin-http|tauri-plugin-os) = .*\n/gm, "").replace('features = ["protocol-asset"]', 'features = []'));
  await edit("src-tauri/src/lib.rs", source => source
    .replace(/^        \.manage\(alwith_auth_client::pets::RuntimeAccess.*\n/m, "")
    .replace(/\nfn pet_owner[\s\S]*$/, "\n")
    .replace(/^        \.plugin\(tauri_plugin_(http|os)::init\(\)\)\n/gm, "")
    .replace(/\.plugin\(alwith_module_store::tauri::init\(\)\)\n        \.plugin\(alwith_auth_client::tauri::init\(Some\([\s\S]*?\)\)\);/, ".plugin(alwith_module_store::tauri::init());"));
  await edit("src-tauri/capabilities/default.json", source => {
    const value = JSON.parse(source);
    value.windows = ["main"];
    value.description = "Chat window: Runtime relay, logs, opening links and local preferences";
    value.permissions = value.permissions.filter((permission: unknown) => typeof permission === "string" && permission !== "os:default" && !permission.startsWith("alwith-auth-client:"));
    return JSON.stringify(value, null, 2) + "\n";
  });
  await edit("scripts/stage.ts", source => source.replace(/^import .*stageNativeAuth.*\n/m, "").replace(/\n\/\/ 5\. The closed auth library[\s\S]*$/, "\n"));
  await edit("vite.config.ts", source => source.replace(', "@alwith/module-auth"', "").replace(/^  build:.*\n/m, ""));
}
