import { generateKeyPairSync, randomBytes, scryptSync } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/** `owner/repo` on github.com; the generated app publishes its releases and update manifest there. */
export function githubRepository(value: unknown): string {
  const text = typeof value === "string" ? value.trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "") : "";
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9_.-]{1,100}$/.test(text)) throw new Error("GitHub repository must be owner/repo");
  return text;
}

export interface UpdaterKeys {
  /** The `pubkey` value for `alwith.app.json` and `plugins.updater`: base64 of the minisign public key file. */
  pubkey: string;
  /** Base64 of the minisign secret key file, the format `TAURI_SIGNING_PRIVATE_KEY` and `tauri signer sign -k` accept. */
  privateKey: string;
}

// Mirrors `tauri signer generate` (minisign 0.7): Ed25519 keys, a BLAKE2b-256 checksum and the key
// material XORed with a scrypt stream (N=2^15, r=8, p=1 from the stored limits). The Tauri CLI derives
// that stream even from an empty password, so an unprotected key is still encoded the same way.
const KDF_OPSLIMIT = 1_048_576n, KDF_MEMLIMIT = 33_554_432n;
const u64le = (value: bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(value); return b; };
export function generateUpdaterKeys(password = ""): UpdaterKeys {
  if (Buffer.byteLength(password) > 1024) throw new Error("The key password cannot exceed 1024 bytes");
  const pair = generateKeyPairSync("ed25519");
  const seed = Buffer.from((pair.privateKey.export({ format: "jwk" }) as { d: string }).d, "base64url");
  const pk = Buffer.from((pair.publicKey.export({ format: "jwk" }) as { x: string }).x, "base64url");
  if (seed.length !== 32 || pk.length !== 32) throw new Error("Unexpected Ed25519 key size");
  const keynum = randomBytes(8), salt = randomBytes(32), sk = Buffer.concat([seed, pk]);
  const checksum = new Bun.CryptoHasher("blake2b256").update(Buffer.concat([Buffer.from("Ed"), keynum, sk])).digest();
  const material = Buffer.concat([keynum, sk, Buffer.from(checksum)]);
  const stream = scryptSync(password, salt, material.length, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  for (let i = 0; i < material.length; i++) material[i] ^= stream[i];
  const secret = Buffer.concat([Buffer.from("EdScB2"), salt, u64le(KDF_OPSLIMIT), u64le(KDF_MEMLIMIT), material]);
  const keyId = keynum.readBigUInt64LE().toString(16).toUpperCase().padStart(16, "0");
  const publicFile = `untrusted comment: minisign public key: ${keyId}\n${Buffer.concat([Buffer.from("Ed"), keynum, pk]).toString("base64")}\n`;
  const secretFile = `untrusted comment: rsign encrypted secret key\n${secret.toString("base64")}\n`;
  return { pubkey: Buffer.from(publicFile).toString("base64"), privateKey: Buffer.from(secretFile).toString("base64") };
}

/** Default private key location, outside every project: `~/.tauri/<name>.key` like the Tauri CLI. */
export function updaterKeyDirectory(): string {
  return join(homedir(), ".tauri");
}

/** Writes `<name>.key` (owner-only) and `<name>.key.pub`; refuses to replace an existing key. */
export async function writeUpdaterKeys(directory: string, name: string, keys: UpdaterKeys): Promise<string> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, `${name}.key`);
  try {
    await writeFile(path, keys.privateKey, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`An updater key already exists at ${path}; move it away or pass --pubkey to reuse its public key`);
    throw error;
  }
  await writeFile(`${path}.pub`, keys.pubkey, { flag: "w", mode: 0o644 });
  return path;
}
