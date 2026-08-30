import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inventoryEvidenceErrors, sha256 } from "./publication-evidence.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArguments(arguments_) {
  const options = { inventory: path.join(repositoryRoot, "_publication", "inventory.json") };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--inventory") options.inventory = arguments_[++index];
    else if (argument === "--expected-sha") options.expectedSha = arguments_[++index];
    else if (argument === "--expected-digest") options.expectedDigest = arguments_[++index];
    else if (argument === "--expected-file-sha256") options.expectedFileSha256 = arguments_[++index];
    else if (argument === "--github-output") options.githubOutput = arguments_[++index];
    else throw new Error(`unknown argument: ${argument}`);
  }
  if (!/^[a-f0-9]{40}$/iu.test(options.expectedSha || "")) throw new Error("--expected-sha must be a full commit SHA");
  for (const [label, value] of [["--expected-digest", options.expectedDigest], ["--expected-file-sha256", options.expectedFileSha256]]) {
    if (value && !/^[a-f0-9]{64}$/iu.test(value)) throw new Error(`${label} must be a SHA-256 digest`);
  }
  return options;
}

const options = parseArguments(process.argv.slice(2));
const bytes = await readFile(options.inventory);
const evidence = JSON.parse(bytes.toString("utf8"));
const errors = inventoryEvidenceErrors(evidence, evidence.files, options.expectedSha.toLowerCase());
const inventoryDigest = evidence.summary?.inventorySha256;
const inventoryFileSha256 = sha256(bytes);
if (options.expectedDigest && inventoryDigest !== options.expectedDigest.toLowerCase()) errors.push("inventory digest changed after validation");
if (options.expectedFileSha256 && inventoryFileSha256 !== options.expectedFileSha256.toLowerCase()) errors.push("inventory file bytes changed after validation");
if (errors.length) throw new Error(errors.join("; "));

if (options.githubOutput) {
  await appendFile(options.githubOutput, `inventory_digest=${inventoryDigest}\ninventory_file_sha256=${inventoryFileSha256}\n`, "utf8");
}
console.log(`Verified inventory for ${evidence.sourceSha}: ${evidence.summary.fileCount} files, inventory ${inventoryDigest}, evidence file ${inventoryFileSha256}`);
