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
    .replace(/^  const \[petsReady, setPetsReady\] = .*\n/m, "")
    .replace(/^    void initializeVibemonMain\(\).*\n/m, "")
    .replace(/  useEffect\(\(\) => \{\n    if \(petsReady\)[\s\S]*?\n  \}, \[petsReady, selected, region\]\)\n/, "")
    .replace('useState<LeadingPage>("pets")', 'useState<LeadingPage>("plugins")')
    .replaceAll(" petsReady={petsReady}", "")
    .replace(' onPets={() => { setLeadingPage("pets"); setScreen("leading") }}', "")
    .replace(/ onShowPet=\{\(\) => \{ void requestPet\("open-pet"\)[^\n]*?\.catch\(report\) \}\}/, "")
    .replace(/^        trailing=\{petsReady && <PetLounge.*\n/m, ""));
  await edit("src/layout/leading.tsx", source => source
    .replace(/^import \{ PetCenter \}.*\n/m, "")
    .replace("ArchiveIcon, LayoutGridIcon, PawPrintIcon", "ArchiveIcon, LayoutGridIcon")
    .replace('export type LeadingPage = "pets" | ', "export type LeadingPage = ")
    .replace("page, onPageChange, petsReady, cwd }", "page, onPageChange, cwd }")
    .replace(/^  petsReady: boolean\n/m, "")
    .replace(/^    \{ id: "pets",.*\n/m, "")
    .replace(/^        \{page === "pets" && petsReady && <PetCenter \/>\}\n/m, ""));
  await edit("src/settings-window.tsx", source => source.replace(/^import .*initPlatformAuth.*\n/m, "").replace(/^void initPlatformAuth\(\)\n/m, ""));
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
    .replace(/^  const user = usePlatformAuth.*\n/m, "")
    .replace(/^  const \[busy, setBusy\].*\n/m, "")
    .replace(/  async function signOut\(\) \{[\s\S]*?\n  \}\n/, "")
    .replace("ContrastIcon, CpuIcon, InfoIcon, LogOutIcon, SlidersHorizontalIcon, UserIcon", "ContrastIcon, CpuIcon, InfoIcon, SlidersHorizontalIcon")
    .replace(/^    \{ id: "account",.*\n/m, "")
    .replace(/      case "account":\n        return user \?[\s\S]*?\) : null\n/, ""));
  await edit("src/layout/navigation.tsx", source => source
    .replace(/^import \{ logoutPlatform, usePlatformAuth \}.*\n/m, "")
    .replace(/^  const user = usePlatformAuth.*\n/m, "")
    .replace("LifeBuoyIcon, PawPrintIcon, ", "LifeBuoyIcon, ")
    .replace("onSelect, onSettings, onPets, onShowPet, petsReady }", "onSelect, onSettings }")
    .replace(/^  (onPets|onShowPet|petsReady):.*\n/gm, "")
    .replace(/^          \{petsReady && \([\s\S]*?\n          \)\}\n/m, "")
    .replace(/            \{user && \(\n              <AccountMenu[\s\S]*?<\/AccountMenu>\n            \)\}\n/, "            <NavigationItemButton onClick={onSettings}>\n              <NavigationLeading><SettingsIcon /></NavigationLeading>\n              <span>{t(\"settings\")}</span>\n            </NavigationItemButton>\n"));
  await edit("src-tauri/Cargo.toml", source => source.replace(/^(alwith-auth-client|alwith-native-client|tauri-plugin-http|tauri-plugin-os) = .*\n/gm, ""));
  await edit("src-tauri/src/lib.rs", source => source
    .replace(/^        \.manage\(alwith_auth_client::pets::RuntimeAccess.*\n/m, "")
    .replace(/\nfn pet_owner[\s\S]*$/, "\n")
    .replace(/^        \.plugin\(tauri_plugin_(http|os)::init\(\)\)\n/gm, "")
    .replace(/\.plugin\(alwith_module_store::tauri::init\(\)\)\n        \.plugin\(alwith_auth_client::tauri::init\(Some\([\s\S]*?\)\)\);/, ".plugin(alwith_module_store::tauri::init());"));
  await edit("src-tauri/capabilities/default.json", source => {
    const value = JSON.parse(source);
    value.windows = ["main", "settings"];
    value.description = "Chat window: Runtime relay, logs, opening links and local preferences";
    value.permissions = value.permissions.filter((permission: unknown) => typeof permission === "string" && permission !== "os:default" && !permission.startsWith("alwith-auth-client:"));
    return JSON.stringify(value, null, 2) + "\n";
  });
  await edit("scripts/stage.ts", source => source.replace(/^import .*stageNativeAuth.*\n/m, "").replace(/\n\/\/ \d\. The closed auth library[\s\S]*?console\.log\(`native auth[^\n]*\n/, "\n"));
  await edit("vite.config.ts", source => source.replace(', "@alwith/module-auth"', "").replace(/^  build:.*\n/m, '  build: {rollupOptions: {input: {main: "index.html", settings: "settings.html"}}},\n'));
}
