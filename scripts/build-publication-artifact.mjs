import { copyFile, lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPublicationAllowlist } from "./publication-allowlist.mjs";
import { buildInventoryEvidence, sha256, verifiedPublicationSourceSha } from "./publication-evidence.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.resolve(repositoryRoot, "_site");
const evidenceRoot = path.resolve(repositoryRoot, "_publication");
const inventoryPath = path.join(evidenceRoot, "inventory.json");
const lexicalCompare = (left, right) => left < right ? -1 : left > right ? 1 : 0;

function assertInsideRepository(candidate, label) {
  const relative = path.relative(repositoryRoot, candidate);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
    throw new Error(`${label} must be a child of the repository: ${candidate}`);
  }
}

async function assertCleanableDirectory(directory, relative = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryRelative = relative ? `${relative}/${entry.name}` : entry.name;
    const entryPath = path.join(directory, entry.name);
    const metadata = await lstat(entryPath);
    if (metadata.isSymbolicLink()) throw new Error(`refusing to clean artifact containing a symlink: ${entryRelative}`);
    if (metadata.isDirectory()) await assertCleanableDirectory(entryPath, entryRelative);
    else if (!metadata.isFile()) throw new Error(`refusing to clean unexpected artifact object: ${entryRelative}`);
  }
}

async function assertRegularSource(relative) {
  let current = repositoryRoot;
  const segments = relative.split("/");

  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    const metadata = await lstat(current);
    if (metadata.isSymbolicLink()) throw new Error(`allow-listed source must not be a symlink: ${relative}`);
    if (index < segments.length - 1 && !metadata.isDirectory()) {
      throw new Error(`allow-listed source parent is not a directory: ${relative}`);
    }
    if (index === segments.length - 1 && !metadata.isFile()) {
      throw new Error(`allow-listed source is not a regular file: ${relative}`);
    }
  }

  return current;
}

const realRepositoryRoot = await realpath(repositoryRoot);
if (realRepositoryRoot !== repositoryRoot) {
  throw new Error(`repository root must resolve directly before artifact cleanup: ${repositoryRoot}`);
}
if (artifactRoot !== path.join(repositoryRoot, "_site") || path.dirname(artifactRoot) !== repositoryRoot) {
  throw new Error(`unsafe publication artifact target: ${artifactRoot}`);
}
assertInsideRepository(artifactRoot, "publication artifact");
assertInsideRepository(evidenceRoot, "publication evidence");

try {
  const metadata = await lstat(artifactRoot);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error(`refusing to replace unsafe publication artifact target: ${artifactRoot}`);
  }
  await assertCleanableDirectory(artifactRoot);
  await rm(artifactRoot, { recursive: true });
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

await mkdir(artifactRoot);
try {
  const metadata = await lstat(evidenceRoot);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error(`publication evidence target must be a real directory: ${evidenceRoot}`);
  }
} catch (error) {
  if (error?.code === "ENOENT") await mkdir(evidenceRoot);
  else throw error;
}
try {
  const metadata = await lstat(inventoryPath);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`publication inventory target must be a regular file: ${inventoryPath}`);
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const allowlist = await getPublicationAllowlist(repositoryRoot);
const sourceSha = await verifiedPublicationSourceSha(repositoryRoot);
const destinations = new Set();
const inventory = [];

for (const relative of allowlist) {
  const source = await assertRegularSource(relative);
  const destination = path.resolve(artifactRoot, ...relative.split("/"));
  assertInsideRepository(source, `allow-listed source ${relative}`);
  const destinationRelative = path.relative(artifactRoot, destination);
  if (!destinationRelative || destinationRelative.startsWith(`..${path.sep}`) || path.isAbsolute(destinationRelative)) {
    throw new Error(`publication destination escapes _site: ${relative}`);
  }
  if (destinations.has(destination)) throw new Error(`duplicate publication destination: ${relative}`);
  destinations.add(destination);

  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);

  const destinationMetadata = await lstat(destination);
  if (destinationMetadata.isSymbolicLink() || !destinationMetadata.isFile()) {
    throw new Error(`publication destination is not a regular file: ${relative}`);
  }

  const [sourceBytes, destinationBytes] = await Promise.all([readFile(source), readFile(destination)]);
  if (!sourceBytes.equals(destinationBytes)) throw new Error(`publication copy changed bytes: ${relative}`);
  inventory.push({ path: relative, bytes: destinationBytes.byteLength, sha256: sha256(destinationBytes) });
}

inventory.sort((left, right) => lexicalCompare(left.path, right.path));
const evidence = buildInventoryEvidence(inventory, sourceSha);

await writeFile(inventoryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(`Built publication artifact from ${sourceSha}: ${inventory.length} files, ${evidence.summary.totalBytes} bytes, inventory SHA-256 ${evidence.summary.inventorySha256}`);
