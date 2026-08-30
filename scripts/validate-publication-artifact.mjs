import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  approvedDocumentFiles,
  explicitlyExcludedUrls,
  getPublicationAllowlist,
  intendedRouteFiles,
  obsoleteOperationalFiles,
  publicTerminologyContractFiles,
  requiredHiddenFiles
} from "./publication-allowlist.mjs";
import {
  evidenceTerminologyErrors,
  namingErrors,
  prohibitedPublicClaimErrors,
  publicDocumentPathErrors,
  uniqueIdErrors
} from "./public-site-contract.mjs";
import { governedAssetErrors, governedAssets, staleGovernedAssetPaths } from "./governed-assets.mjs";
import { publicationReferenceErrors } from "./publication-references.mjs";
import {
  buildInventoryEvidence,
  inventoryEvidenceErrors,
  sha256,
  verifiedPublicationSourceSha
} from "./publication-evidence.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.resolve(repositoryRoot, "_site");
const inventoryPath = path.resolve(repositoryRoot, "_publication", "inventory.json");
const lexicalCompare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const errors = [];

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

for (const obsoleteFile of obsoleteOperationalFiles) {
  try {
    await lstat(path.join(repositoryRoot, ...obsoleteFile.split("/")));
    errors.push(`${obsoleteFile}: obsolete operational file must remain deleted`);
  } catch (error) {
    if (error?.code !== "ENOENT") errors.push(`${obsoleteFile}: cannot prove obsolete file absence (${error.message})`);
  }
}

const governedManifestPaths = governedAssets.map((asset) => asset.path).sort(lexicalCompare);
const discoveredGovernedPaths = [
  ...(await readdir(repositoryRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /\.(?:png|jpe?g|ico|svg)$/iu.test(entry.name))
    .map((entry) => entry.name),
  ...(await readdir(path.join(repositoryRoot, "assets"), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /\.(?:png|jpe?g|ico|svg)$/iu.test(entry.name))
    .map((entry) => `assets/${entry.name}`)
].sort(lexicalCompare);
if (JSON.stringify(discoveredGovernedPaths) !== JSON.stringify(governedManifestPaths)) {
  errors.push(`governed asset manifest paths differ from root icons and assets/ images (manifest: ${governedManifestPaths.join(", ")}; discovered: ${discoveredGovernedPaths.join(", ")})`);
}

for (const asset of governedAssets) {
  if (!asset.path || !asset.sha256 || !asset.mediaType || !asset.signature || !asset.bytes || !asset.purpose) {
    errors.push(`${asset.path || "unnamed governed asset"}: manifest entry is incomplete`);
    continue;
  }
  try {
    const bytes = await readFile(path.join(repositoryRoot, ...asset.path.split("/")));
    for (const message of governedAssetErrors(asset, bytes)) errors.push(message);
  } catch (error) {
    errors.push(`${asset.path}: governed asset is missing or unreadable (${error.message})`);
  }
}

for (const stalePath of staleGovernedAssetPaths) {
  try {
    await lstat(path.join(repositoryRoot, ...stalePath.split("/")));
    errors.push(`${stalePath}: stale or deleted governed asset path must not exist`);
  } catch (error) {
    if (error?.code !== "ENOENT") errors.push(`${stalePath}: cannot prove stale path absence (${error.message})`);
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
const sourceSha = await verifiedPublicationSourceSha(repositoryRoot);
const expectedEvidence = buildInventoryEvidence(inventory, sourceSha);
const { totalBytes, inventorySha256: digest } = expectedEvidence.summary;

try {
  const evidenceDirectoryMetadata = await lstat(path.dirname(inventoryPath));
  const evidenceMetadata = await lstat(inventoryPath);
  if (evidenceDirectoryMetadata.isSymbolicLink() || !evidenceDirectoryMetadata.isDirectory()) {
    errors.push("_publication must be a regular, non-symlink directory");
  } else if (evidenceMetadata.isSymbolicLink() || !evidenceMetadata.isFile()) {
    errors.push("_publication/inventory.json must be a regular, non-symlink file");
  } else {
    const recordedEvidence = JSON.parse(await readFile(inventoryPath, "utf8"));
    for (const message of inventoryEvidenceErrors(recordedEvidence, inventory, sourceSha)) errors.push(`_publication/inventory.json: ${message}`);
  }
} catch (error) {
  errors.push(`publication inventory evidence is missing or invalid (${error.message})`);
}

const artifactContents = new Map();
for (const file of artifactFiles) artifactContents.set(file, await readFile(path.join(artifactRoot, ...file.split("/"))));
for (const message of publicationReferenceErrors(artifactContents)) errors.push(message);
for (const [file, bytes] of artifactContents) {
  if (!/\.(?:html|svg|md)$/iu.test(file)) continue;
  const value = bytes.toString("utf8");
  for (const message of namingErrors(value, file)) errors.push(`${file}: ${message}`);
  for (const message of prohibitedPublicClaimErrors(value)) errors.push(`${file}: ${message}`);
  for (const message of evidenceTerminologyErrors(value)) errors.push(`${file}: ${message}`);
  if (/\.(?:html|svg)$/iu.test(file)) for (const message of uniqueIdErrors(value)) errors.push(`${file}: ${message}`);
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`Validated exact publication artifact: ${inventory.length} files, ${governedAssets.length} governed assets, ${totalBytes} bytes, inventory SHA-256 ${digest}`);
