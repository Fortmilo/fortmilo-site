import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPublicationAllowlist } from "./publication-allowlist.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const representativePositiveUrls = Object.freeze([
  "/",
  "/.well-known/security.txt",
  "/EVIDENCE_TERMINOLOGY_CONTRACT.md",
  "/documents/",
  "/documents/evidence-semantics-and-scanner-orchestration.pdf",
  "/documents/orchestrating-ai-for-secure-software-delivery.pdf",
  "/documents/security-observatory-reference-architecture.svg",
  "/security-observatory/",
  "/security-observatory/evidence.html"
]);

const excludedUrls = Object.freeze([
  "/.github/workflows/validate-site.yml",
  "/AGENTS.md",
  "/CLAUDE.md",
  "/CURRENT_EVIDENCE_TERMINOLOGY_CONTRACT.md",
  "/EVIDENCE_TERMINOLOGY_CONTRACT_V1.1.md",
  "/README.md",
  "/document-src/",
  "/package-lock.json",
  "/package.json",
  "/pages-deployment-trigger.txt",
  "/documents/evidence-semantics-and-scanner-orchestration-v1.3.pdf",
  "/documents/evidence-semantics-and-scanner-orchestration-v1.4.pdf",
  "/documents/security-observatory-reference-architecture-v4.1.svg",
  "/documents/security-observatory-reference-architecture-v4.2.svg",
  "/scripts/build-site.mjs",
  "/site-src/"
]);

function parseArguments(arguments_) {
  const options = {
    baseUrl: process.env.PUBLICATION_BASE_URL,
    attempts: Number(process.env.PUBLICATION_VERIFY_ATTEMPTS || "1"),
    delayMs: Number(process.env.PUBLICATION_VERIFY_DELAY_MS || "0"),
    all: false,
    verbose: false
  };

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--all") options.all = true;
    else if (argument === "--verbose") options.verbose = true;
    else if (argument === "--base-url") options.baseUrl = arguments_[++index];
    else if (argument === "--attempts") options.attempts = Number(arguments_[++index]);
    else if (argument === "--delay-ms") options.delayMs = Number(arguments_[++index]);
    else throw new Error(`unknown argument: ${argument}`);
  }

  if (!options.baseUrl) throw new Error("--base-url or PUBLICATION_BASE_URL is required");
  if (!Number.isInteger(options.attempts) || options.attempts < 1 || options.attempts > 120) {
    throw new Error("--attempts must be an integer from 1 to 120");
  }
  if (!Number.isInteger(options.delayMs) || options.delayMs < 0 || options.delayMs > 60_000) {
    throw new Error("--delay-ms must be an integer from 0 to 60000");
  }
  options.baseUrl = new URL(options.baseUrl).toString();
  return options;
}

function publicUrlForFile(file) {
  if (file === "index.html") return "/";
  if (file.endsWith("/index.html")) return `/${file.slice(0, -"index.html".length)}`;
  return `/${file}`;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function checkUrl(baseUrl, urlPath, expectedStatus, nonce) {
  const url = new URL(urlPath, baseUrl);
  url.searchParams.set("publication-check", nonce);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000)
    });
    await response.body?.cancel();
    return { path: urlPath, expectedStatus, actualStatus: response.status, passed: response.status === expectedStatus };
  } catch (error) {
    return { path: urlPath, expectedStatus, actualStatus: "request-error", error: error.message, passed: false };
  }
}

const options = parseArguments(process.argv.slice(2));
const positiveUrls = options.all
  ? [...new Set((await getPublicationAllowlist(repositoryRoot)).map(publicUrlForFile))].sort()
  : representativePositiveUrls;

let passed = false;
for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
  const nonce = `${process.env.GITHUB_RUN_ID || process.pid}-${Date.now()}-${attempt}`;
  const results = await Promise.all([
    ...positiveUrls.map((urlPath) => checkUrl(options.baseUrl, urlPath, 200, nonce)),
    ...excludedUrls.map((urlPath) => checkUrl(options.baseUrl, urlPath, 404, nonce))
  ]);

  const failures = results.filter((result) => !result.passed);
  if (options.verbose || failures.length) {
    for (const result of results) {
      if (options.verbose || !result.passed) {
        console.log(`${result.passed ? "PASS" : "FAIL"} ${result.actualStatus} ${result.path} (expected ${result.expectedStatus})${result.error ? `: ${result.error}` : ""}`);
      }
    }
  }

  if (!failures.length) {
    console.log(`HTTP publication verification passed: ${positiveUrls.length} intended URL(s) returned 200; ${excludedUrls.length} excluded URL(s) returned genuine 404 responses`);
    passed = true;
    break;
  }

  if (attempt < options.attempts) {
    console.log(`Publication verification attempt ${attempt}/${options.attempts} has ${failures.length} failure(s); retrying after ${options.delayMs} ms`);
    await sleep(options.delayMs);
  }
}

if (!passed) {
  console.error(`HTTP publication verification failed after ${options.attempts} attempt(s)`);
  process.exitCode = 1;
}
