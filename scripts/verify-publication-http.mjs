import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { explicitlyExcludedUrls, getPublicationAllowlist } from "./publication-allowlist.mjs";
import { inventoryEvidenceErrors, sha256 } from "./publication-evidence.mjs";
import { publicationReferenceErrors, publicUrlForFile } from "./publication-references.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stablePublicationFiles = Object.freeze([
  "documents/evidence-semantics-and-scanner-orchestration.pdf",
  "documents/orchestrating-ai-for-secure-software-delivery.pdf",
  "documents/security-observatory-reference-architecture.svg",
  "EVIDENCE_TERMINOLOGY_CONTRACT.md"
]);

function parseArguments(arguments_) {
  const options = {
    baseUrl: process.env.PUBLICATION_BASE_URL,
    inventoryPath: process.env.PUBLICATION_INVENTORY || path.join(repositoryRoot, "_publication", "inventory.json"),
    requestedSha: process.env.PUBLICATION_REQUESTED_SHA,
    deploymentSha: process.env.PUBLICATION_DEPLOYMENT_SHA,
    inventoryDigest: process.env.PUBLICATION_INVENTORY_DIGEST,
    workflowRunId: process.env.GITHUB_RUN_ID,
    attempts: Number(process.env.PUBLICATION_VERIFY_ATTEMPTS || "1"),
    delayMs: Number(process.env.PUBLICATION_VERIFY_DELAY_MS || "0"),
    verbose: false
  };

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--verbose") options.verbose = true;
    else if (argument === "--base-url") options.baseUrl = arguments_[++index];
    else if (argument === "--inventory") options.inventoryPath = arguments_[++index];
    else if (argument === "--requested-sha") options.requestedSha = arguments_[++index];
    else if (argument === "--deployment-sha") options.deploymentSha = arguments_[++index];
    else if (argument === "--inventory-digest") options.inventoryDigest = arguments_[++index];
    else if (argument === "--workflow-run-id") options.workflowRunId = arguments_[++index];
    else if (argument === "--attempts") options.attempts = Number(arguments_[++index]);
    else if (argument === "--delay-ms") options.delayMs = Number(arguments_[++index]);
    else throw new Error(`unknown argument: ${argument}`);
  }

  if (!options.baseUrl) throw new Error("--base-url or PUBLICATION_BASE_URL is required");
  const parsedBase = new URL(options.baseUrl);
  if (parsedBase.pathname !== "/" || parsedBase.search || parsedBase.hash) throw new Error("--base-url must be an origin root URL");
  options.baseUrl = parsedBase.toString();
  for (const [label, value, length] of [
    ["requested SHA", options.requestedSha, 40],
    ["deployment SHA", options.deploymentSha, 40],
    ["inventory digest", options.inventoryDigest, 64]
  ]) if (!new RegExp(`^[a-f0-9]{${length}}$`, "iu").test(value || "")) throw new Error(`${label} must be a full hexadecimal digest`);
  if (options.requestedSha.toLowerCase() !== options.deploymentSha.toLowerCase()) throw new Error("requested SHA differs from deployment SHA");
  if (!/^\d+$/u.test(options.workflowRunId || "")) throw new Error("workflow run ID must be numeric");
  if (!Number.isInteger(options.attempts) || options.attempts < 1 || options.attempts > 120) throw new Error("--attempts must be an integer from 1 to 120");
  if (!Number.isInteger(options.delayMs) || options.delayMs < 0 || options.delayMs > 60_000) throw new Error("--delay-ms must be an integer from 0 to 60000");
  return options;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function intendedResponseErrors(entry, result, notFoundDigest) {
  const errors = [];
  if (result.error) return [`${entry.path}: request error (${result.error})`];
  if (result.status >= 300 && result.status < 400) return [`${entry.path}: unexpected redirect ${result.status}${result.location ? ` to ${result.location}` : ""}`];
  if (result.status !== 200) errors.push(`${entry.path}: expected HTTP 200, found ${result.status}`);
  const digest = sha256(result.bytes);
  if (entry.path !== "404.html" && digest === notFoundDigest) errors.push(`${entry.path}: branded soft-404 bytes returned for intended file`);
  if (result.bytes.byteLength !== entry.bytes) errors.push(`${entry.path}: live byte size ${result.bytes.byteLength} differs from inventory ${entry.bytes}`);
  if (digest !== entry.sha256) errors.push(`${entry.path}: live SHA-256 ${digest} differs from inventory ${entry.sha256}`);
  return errors;
}

export function excludedResponseErrors(urlPath, result, notFoundDigest) {
  if (result.error) return [`${urlPath}: request error (${result.error})`];
  if (result.status >= 300 && result.status < 400) return [`${urlPath}: unexpected redirect ${result.status}${result.location ? ` to ${result.location}` : ""}`];
  if (result.status === 200 && sha256(result.bytes) === notFoundDigest) return [`${urlPath}: branded soft-404 returned HTTP 200`];
  return result.status === 404 ? [] : [`${urlPath}: expected genuine HTTP 404, found ${result.status}`];
}

async function fetchPath(baseUrl, urlPath, nonce) {
  const url = new URL(urlPath, baseUrl);
  url.searchParams.set("publication-check", nonce);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache, no-store, max-age=0", "Accept-Encoding": "identity" },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000)
    });
    return {
      status: response.status,
      location: response.headers.get("location"),
      bytes: Buffer.from(await response.arrayBuffer())
    };
  } catch (error) {
    return { status: "request-error", bytes: Buffer.alloc(0), error: error.message };
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const inventory = JSON.parse(await readFile(options.inventoryPath, "utf8"));
  const requestedSha = options.requestedSha.toLowerCase();
  const deploymentSha = options.deploymentSha.toLowerCase();
  const inventoryDigest = options.inventoryDigest.toLowerCase();
  const allowlist = await getPublicationAllowlist(repositoryRoot);
  const inventoryPaths = inventory.files?.map((file) => file.path) || [];
  if (JSON.stringify(inventoryPaths) !== JSON.stringify(allowlist)) throw new Error("publication inventory does not enumerate the exact allow-list");
  const evidenceErrors = inventoryEvidenceErrors(inventory, inventory.files, requestedSha);
  if (evidenceErrors.length) throw new Error(evidenceErrors.join("; "));
  if (inventory.summary.inventorySha256 !== inventoryDigest) throw new Error("provided inventory digest differs from inventory evidence");
  for (const file of stablePublicationFiles) if (!inventoryPaths.includes(file)) throw new Error(`stable publication file is absent from inventory: ${file}`);

  const notFoundEntry = inventory.files.find((entry) => entry.path === "404.html");
  if (!notFoundEntry) throw new Error("404.html is absent from publication inventory");
  let passed = false;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    const nonce = `${options.workflowRunId}-${Date.now()}-${attempt}`;
    const intendedResults = await Promise.all(inventory.files.map(async (entry) => [entry, await fetchPath(options.baseUrl, publicUrlForFile(entry.path), nonce)]));
    const excludedResults = await Promise.all(explicitlyExcludedUrls.map(async (urlPath) => [urlPath, await fetchPath(options.baseUrl, urlPath, nonce)]));
    const liveContents = new Map();
    const failures = [];

    for (const [entry, result] of intendedResults) {
      const resultErrors = intendedResponseErrors(entry, result, notFoundEntry.sha256);
      failures.push(...resultErrors);
      if (!resultErrors.length) liveContents.set(entry.path, result.bytes);
    }
    for (const [urlPath, result] of excludedResults) failures.push(...excludedResponseErrors(urlPath, result, notFoundEntry.sha256));
    if (liveContents.size === inventory.files.length) failures.push(...publicationReferenceErrors(liveContents, new URL(options.baseUrl).origin));

    if (options.verbose || failures.length) for (const failure of failures) console.log(`FAIL ${failure}`);
    if (!failures.length) {
      console.log(`Live publication verified: requested ${requestedSha}; deployed ${deploymentSha}; workflow run ${options.workflowRunId}; inventory ${inventoryDigest}; ${inventory.files.length} exact files; ${explicitlyExcludedUrls.length} genuine 404 exclusions`);
      passed = true;
      break;
    }
    if (attempt < options.attempts) {
      console.log(`Publication verification attempt ${attempt}/${options.attempts} has ${failures.length} failure(s); retrying after ${options.delayMs} ms`);
      await sleep(options.delayMs);
    }
  }

  if (!passed) throw new Error(`HTTP publication verification failed after ${options.attempts} attempt(s)`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}
