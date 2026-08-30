import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  approvedDocumentFiles,
  getPublicationAllowlist,
  intendedRouteFiles,
  publicTerminologyContractFiles,
  requiredHiddenFiles
} from "./publication-allowlist.mjs";
import { publicDocumentPathErrors } from "./public-site-contract.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.resolve(repositoryRoot, "_site");
const inventoryPath = path.resolve(repositoryRoot, "_publication", "inventory.json");
const productionOrigin = "https://fortmilo.co.uk";
const lexicalCompare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const errors = [];

const explicitlyExcludedUrls = Object.freeze([
  "/.github/workflows/validate-site.yml",
  "/AGENTS.md",
  "/CLAUDE.md",
  "/README.md",
  "/document-src/",
  "/package-lock.json",
  "/package.json",
  "/pages-deployment-trigger.txt",
  "/scripts/build-site.mjs",
  "/site-src/"
]);

const bannedDirectories = new Set([
  ".git",
  ".github",
  "document-src",
  "node_modules",
  "scripts",
  "site-src"
]);

const bannedFileNames = new Set([
  ".gitignore",
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "package-lock.json",
  "package.json",
  "pages-deployment-trigger.txt"
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function inventorySha256(files) {
  const canonical = files.map((file) => `${file.sha256}  ${file.bytes}  ${file.path}\n`).join("");
  return sha256(Buffer.from(canonical, "utf8"));
}

async function enumerateArtifact(directory, prefix = "") {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const entryPath = path.join(directory, entry.name);
    const metadata = await lstat(entryPath);
    if (metadata.isSymbolicLink()) {
      errors.push(`${relative}: publication artifact must not contain symlinks`);
      continue;
    }
    if (metadata.isDirectory()) files.push(...await enumerateArtifact(entryPath, relative));
    else if (metadata.isFile()) files.push(relative);
    else errors.push(`${relative}: publication artifact contains an unexpected filesystem object`);
  }

  return files;
}

async function assertRegularSource(relative) {
  let current = repositoryRoot;
  const segments = relative.split("/");

  try {
    for (let index = 0; index < segments.length; index += 1) {
      current = path.join(current, segments[index]);
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink()) {
        errors.push(`${relative}: allow-listed source must not be a symlink`);
        return false;
      }
      if (index < segments.length - 1 && !metadata.isDirectory()) {
        errors.push(`${relative}: allow-listed source parent is not a directory`);
        return false;
      }
      if (index === segments.length - 1 && !metadata.isFile()) {
        errors.push(`${relative}: allow-listed source is not a regular file`);
        return false;
      }
    }
  } catch (error) {
    errors.push(`${relative}: allow-listed source is missing (${error.message})`);
    return false;
  }

  return true;
}

function resolveArtifactReference(reference, owner) {
  const decodedReference = reference.replaceAll("&amp;", "&").trim();
  if (!decodedReference || /^(?:#|data:|mailto:|tel:|javascript:)/iu.test(decodedReference)) return null;

  let url;
  try {
    url = new URL(decodedReference, `${productionOrigin}/${owner}`);
  } catch {
    errors.push(`${owner}: invalid internal reference ${reference}`);
    return null;
  }

  if (!/^https?:$/u.test(url.protocol) || url.origin !== productionOrigin) return null;

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    errors.push(`${owner}: invalid percent encoding in ${reference}`);
    return null;
  }
  if (!pathname.startsWith("/") || pathname.includes("\\")) {
    errors.push(`${owner}: unsafe internal reference ${reference}`);
    return null;
  }

  const relative = pathname.slice(1);
  if (!relative) return "index.html";
  return pathname.endsWith("/") ? `${relative}index.html` : relative;
}

function referencesFromMarkup(value) {
  const references = [];
  for (const match of value.matchAll(/\b(?:href|src|poster|action)\s*=\s*(["'])(.*?)\1/giu)) {
    references.push(match[2]);
  }
  for (const match of value.matchAll(/\bsrcset\s*=\s*(["'])(.*?)\1/giu)) {
    for (const candidate of match[2].split(",")) references.push(candidate.trim().split(/\s+/u, 1)[0]);
  }
  for (const match of value.matchAll(/<meta\b[^>]*\bcontent\s*=\s*(["'])(.*?)\1[^>]*>/giu)) {
    if (/^(?:https?:\/\/fortmilo\.co\.uk\/|\/)/u.test(match[2])) references.push(match[2]);
  }
  return references;
}

function referencesFromMarkdown(value) {
  return [...value.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/gu)].map((match) => match[1]);
}

function referencesFromCss(value) {
  return [...value.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/giu)].map((match) => match[2]);
}

async function validateInternalLinks(files, fileSet) {
  for (const file of files) {
    const extension = path.posix.extname(file).toLowerCase();
    let references = [];

    if (extension === ".html" || extension === ".svg") {
      references = referencesFromMarkup(await readFile(path.join(artifactRoot, ...file.split("/")), "utf8"));
    } else if (extension === ".md") {
      references = referencesFromMarkdown(await readFile(path.join(artifactRoot, ...file.split("/")), "utf8"));
    } else if (extension === ".css") {
      references = referencesFromCss(await readFile(path.join(artifactRoot, ...file.split("/")), "utf8"));
    } else if (file === "site.webmanifest") {
      const manifest = JSON.parse(await readFile(path.join(artifactRoot, file), "utf8"));
      references = [manifest.start_url, manifest.scope, ...(manifest.icons || []).map((icon) => icon.src)].filter(Boolean);
    } else if (file === "sitemap.xml") {
      const sitemap = await readFile(path.join(artifactRoot, file), "utf8");
      references = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/gu)].map((match) => match[1]);
    } else if (file === "robots.txt") {
      const robots = await readFile(path.join(artifactRoot, file), "utf8");
      references = [...robots.matchAll(/^Sitemap:\s*(\S+)\s*$/gimu)].map((match) => match[1]);
    } else if (file === ".well-known/security.txt") {
      const security = await readFile(path.join(artifactRoot, ...file.split("/")), "utf8");
      references = [...security.matchAll(/^Canonical:\s*(\S+)\s*$/gimu)].map((match) => match[1]);
    }

    for (const reference of references) {
      const target = resolveArtifactReference(reference, file);
      if (target && !fileSet.has(target)) {
        errors.push(`${file}: internal reference has no exact case-sensitive artifact target: ${reference}`);
      }
    }
  }
}

if (artifactRoot !== path.join(repositoryRoot, "_site") || path.dirname(artifactRoot) !== repositoryRoot) {
  throw new Error(`unsafe publication artifact target: ${artifactRoot}`);
}

let artifactMetadata;
try {
  artifactMetadata = await lstat(artifactRoot);
} catch (error) {
  throw new Error(`publication artifact is missing: ${artifactRoot}`, { cause: error });
}
if (artifactMetadata.isSymbolicLink() || !artifactMetadata.isDirectory()) {
  throw new Error(`publication artifact root must be a real directory: ${artifactRoot}`);
}

const expectedFiles = await getPublicationAllowlist(repositoryRoot);
const expectedSet = new Set(expectedFiles);
const artifactFiles = (await enumerateArtifact(artifactRoot)).sort(lexicalCompare);
const artifactSet = new Set(artifactFiles);
for (const message of publicDocumentPathErrors(artifactFiles)) errors.push(message);

for (const file of expectedFiles) {
  if (!artifactSet.has(file)) errors.push(`${file}: expected publication file is missing`);
}
for (const file of artifactFiles) {
  if (!expectedSet.has(file)) errors.push(`${file}: unexpected publication file is present`);
}

const requiredFiles = [
  ...requiredHiddenFiles,
  "CNAME",
  ...intendedRouteFiles,
  ...approvedDocumentFiles,
  ...publicTerminologyContractFiles
];
for (const file of requiredFiles) {
  if (!artifactSet.has(file)) errors.push(`${file}: required customer-facing publication file is missing`);
}

for (const file of artifactFiles) {
  const segments = file.split("/");
  if (segments.some((segment) => bannedDirectories.has(segment))) {
    errors.push(`${file}: banned operational directory appears in the publication artifact`);
  }
  if (bannedFileNames.has(segments.at(-1))) {
    errors.push(`${file}: banned operational filename appears in the publication artifact`);
  }
  if (file.endsWith(".map")) errors.push(`${file}: source maps are not approved for publication`);
}

for (const urlPath of explicitlyExcludedUrls) {
  const relative = urlPath.slice(1);
  const candidate = urlPath.endsWith("/") ? `${relative}index.html` : relative;
  if (artifactSet.has(candidate)) errors.push(`${urlPath}: excluded operational URL is published`);
  if (urlPath.endsWith("/") && artifactFiles.some((file) => file.startsWith(relative))) {
    errors.push(`${urlPath}: excluded operational directory has published descendants`);
  }
}

const inventory = [];
for (const file of expectedFiles) {
  if (!artifactSet.has(file) || !await assertRegularSource(file)) continue;
  const sourcePath = path.join(repositoryRoot, ...file.split("/"));
  const artifactPath = path.join(artifactRoot, ...file.split("/"));
  const [sourceBytes, artifactBytes] = await Promise.all([readFile(sourcePath), readFile(artifactPath)]);
  const sourceDigest = sha256(sourceBytes);
  const artifactDigest = sha256(artifactBytes);
  if (sourceDigest !== artifactDigest || !sourceBytes.equals(artifactBytes)) {
    errors.push(`${file}: published bytes do not match the allow-listed source`);
  }
  inventory.push({ path: file, bytes: artifactBytes.byteLength, sha256: artifactDigest });
}

inventory.sort((left, right) => lexicalCompare(left.path, right.path));
const totalBytes = inventory.reduce((total, file) => total + file.bytes, 0);
const digest = inventorySha256(inventory);
const expectedEvidence = {
  version: 1,
  files: inventory,
  summary: {
    fileCount: inventory.length,
    totalBytes,
    inventorySha256: digest
  }
};

try {
  const evidenceDirectoryMetadata = await lstat(path.dirname(inventoryPath));
  const evidenceMetadata = await lstat(inventoryPath);
  if (evidenceDirectoryMetadata.isSymbolicLink() || !evidenceDirectoryMetadata.isDirectory()) {
    errors.push("_publication must be a regular, non-symlink directory");
  } else if (evidenceMetadata.isSymbolicLink() || !evidenceMetadata.isFile()) {
    errors.push("_publication/inventory.json must be a regular, non-symlink file");
  } else {
    const recordedEvidence = JSON.parse(await readFile(inventoryPath, "utf8"));
    if (!isDeepStrictEqual(recordedEvidence, expectedEvidence)) {
      errors.push("_publication/inventory.json does not match the independently enumerated artifact");
    }
  }
} catch (error) {
  errors.push(`publication inventory evidence is missing or invalid (${error.message})`);
}

await validateInternalLinks(artifactFiles, artifactSet);

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`Validated exact publication artifact: ${inventory.length} files, ${totalBytes} bytes, inventory SHA-256 ${digest}`);
