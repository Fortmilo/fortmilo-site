import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function inventorySha256(files) {
  const canonical = files.map((file) => `${file.sha256}  ${file.bytes}  ${file.path}\n`).join("");
  return sha256(Buffer.from(canonical, "utf8"));
}

export function buildInventoryEvidence(files, sourceSha) {
  const totalBytes = files.reduce((total, file) => total + file.bytes, 0);
  return {
    version: 2,
    sourceSha,
    files,
    summary: {
      fileCount: files.length,
      totalBytes,
      inventorySha256: inventorySha256(files)
    }
  };
}

export async function repositoryHead(repositoryRoot) {
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, windowsHide: true });
  const head = stdout.trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/u.test(head)) throw new Error(`git rev-parse HEAD returned an invalid commit: ${JSON.stringify(head)}`);
  return head;
}

export async function verifiedPublicationSourceSha(repositoryRoot, requested = process.env.PUBLICATION_SOURCE_SHA) {
  const head = await repositoryHead(repositoryRoot);
  if (requested && requested.toLowerCase() !== head) {
    throw new Error(`publication source SHA ${requested.toLowerCase()} differs from checkout HEAD ${head}`);
  }
  return head;
}

export function inventoryEvidenceErrors(evidence, expectedFiles, expectedSourceSha) {
  const errors = [];
  if (evidence?.version !== 2) errors.push("publication inventory version must be 2");
  if (evidence?.sourceSha !== expectedSourceSha) errors.push(`publication inventory source SHA ${evidence?.sourceSha} differs from verified checkout ${expectedSourceSha}`);
  if (!Array.isArray(evidence?.files)) return [...errors, "publication inventory files must be an array"];
  if (JSON.stringify(evidence.files) !== JSON.stringify(expectedFiles)) errors.push("publication inventory files differ from independently enumerated artifact bytes");
  const expectedSummary = {
    fileCount: expectedFiles.length,
    totalBytes: expectedFiles.reduce((total, file) => total + file.bytes, 0),
    inventorySha256: inventorySha256(expectedFiles)
  };
  if (JSON.stringify(evidence.summary) !== JSON.stringify(expectedSummary)) errors.push("publication inventory summary is invalid");
  return errors;
}
