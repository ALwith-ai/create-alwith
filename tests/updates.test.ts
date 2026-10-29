import { expect, test } from "bun:test";
import { createPublicKey, scryptSync, sign, verify } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateUpdaterKeys, githubRepository, writeUpdaterKeys } from "../src/updates";

function decodeSecret(privateKey: string, password: string) {
  const text = Buffer.from(privateKey, "base64").toString();
  const [comment, encoded] = text.split("\n");
  const bytes = Buffer.from(encoded, "base64");
  const stream = scryptSync(password, bytes.subarray(6, 38), 104, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const material = Buffer.from(bytes.subarray(54, 158).map((value, index) => value ^ stream[index]));
  const checksum = new Bun.CryptoHasher("blake2b256").update(Buffer.concat([Buffer.from("Ed"), material.subarray(0, 8), material.subarray(8, 72)])).digest();
  return { comment, bytes, keynum: material.subarray(0, 8), seed: material.subarray(8, 40), pk: material.subarray(40, 72), checksumValid: Buffer.from(checksum).equals(material.subarray(72, 104)) };
}

test("keys follow the Tauri CLI minisign layout and the password protects them", () => {
  for (const password of ["", "correct horse"]) {
    const keys = generateUpdaterKeys(password);
    const secret = decodeSecret(keys.privateKey, password);
    expect(secret.comment).toBe("untrusted comment: rsign encrypted secret key");
    expect(secret.bytes.length).toBe(158);
    expect(secret.bytes.subarray(0, 6).toString()).toBe("EdScB2");
    expect(secret.bytes.readBigUInt64LE(38)).toBe(1_048_576n);
    expect(secret.bytes.readBigUInt64LE(46)).toBe(33_554_432n);
    expect(secret.checksumValid).toBe(true);
    expect(decodeSecret(keys.privateKey, `${password}x`).checksumValid).toBe(false);
    const [publicComment, publicEncoded] = Buffer.from(keys.pubkey, "base64").toString().split("\n");
    const publicBytes = Buffer.from(publicEncoded, "base64");
    expect(publicBytes.length).toBe(42);
    expect(publicBytes.subarray(0, 2).toString()).toBe("Ed");
    expect(publicBytes.subarray(2, 10).equals(secret.keynum)).toBe(true);
    expect(publicBytes.subarray(10).equals(secret.pk)).toBe(true);
    expect(publicComment).toBe(`untrusted comment: minisign public key: ${secret.keynum.readBigUInt64LE().toString(16).toUpperCase().padStart(16, "0")}`);
    // The seed signs what the published public key verifies (minisign prehashes with BLAKE2b-512).
    const message = Buffer.from(new Bun.CryptoHasher("blake2b512").update("release archive").digest());
    const privateKey = { key: { kty: "OKP", crv: "Ed25519", d: secret.seed.toString("base64url"), x: secret.pk.toString("base64url") }, format: "jwk" as const };
    const publicKey = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: publicBytes.subarray(10).toString("base64url") }, format: "jwk" });
    expect(verify(null, message, publicKey, sign(null, message, privateKey))).toBe(true);
  }
  expect(generateUpdaterKeys().pubkey).not.toBe(generateUpdaterKeys().pubkey);
});

test("key files are private, never replaced, and the repository is normalized", async () => {
  const directory = await mkdtemp(join(tmpdir(), "create-alwith-keys-"));
  try {
    const keys = generateUpdaterKeys("pw");
    const path = await writeUpdaterKeys(directory, "my-buddy", keys);
    expect(path).toBe(join(directory, "my-buddy.key"));
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(await readFile(path, "utf8")).toBe(keys.privateKey);
    expect(await readFile(`${path}.pub`, "utf8")).toBe(keys.pubkey);
    await expect(writeUpdaterKeys(directory, "my-buddy", generateUpdaterKeys())).rejects.toThrow("already exists");
    expect(await readFile(path, "utf8")).toBe(keys.privateKey);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  expect(githubRepository(" https://github.com/Example/my.app.git ")).toBe("Example/my.app");
  for (const value of ["", "owner", "owner/", "/repo", "owner/repo/extra", "-owner/repo", 42]) expect(() => githubRepository(value)).toThrow("owner/repo");
});
