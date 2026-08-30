import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deploymentProofErrors } from "./deployment-proof.mjs";
import { sha256 } from "./publication-evidence.mjs";
import { intendedResponseErrors } from "./verify-publication-http.mjs";
import { deploymentEventErrors, workflowContractErrors } from "./workflow-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowDirectory = path.join(root, ".github", "workflows");
const workflows = new Map();
for (const name of await readdir(workflowDirectory)) {
  if (/\.ya?ml$/iu.test(name)) workflows.set(name, await readFile(path.join(workflowDirectory, name), "utf8"));
}
assert.deepEqual(workflowContractErrors(workflows), []);

assert.deepEqual(deploymentEventErrors({ ref: "refs/heads/main", eventName: "push", defaultBranch: "main" }), []);
assert.ok(deploymentEventErrors({ ref: "refs/heads/feature", eventName: "workflow_dispatch", defaultBranch: "main" }).some((value) => value.includes("refs/heads/main")));

const requestedSha = "a".repeat(40);
const correctDeployment = { id: 17, sha: requestedSha, ref: "main", environment: "github-pages" };
const correctStatuses = new Map([[17, [{ state: "success", log_url: "https://github.com/Fortmilo/fortmilo-site/actions/runs/123/job/456" }]]]);
const correctProof = {
  requestedSha,
  githubRef: "refs/heads/main",
  workflowRunId: "123",
  pagesStatus: { status: "succeed" },
  deployments: [correctDeployment],
  statusesByDeployment: correctStatuses,
  workflowRuns: [{ id: 123, head_branch: "main", event: "push", status: "in_progress", conclusion: null }]
};
assert.deepEqual(deploymentProofErrors(correctProof), []);
assert.ok(deploymentProofErrors({ ...correctProof, deployments: [{ ...correctDeployment, sha: "b".repeat(40) }] }).some((value) => value.includes("no github-pages deployment")), "wrong deployment SHA must fail");
assert.ok(deploymentProofErrors({ ...correctProof, pagesStatus: { status: "cancelled" } }).some((value) => value.includes("did not report succeed")), "cancelled Pages deployment must fail");
assert.ok(deploymentProofErrors({
  ...correctProof,
  workflowRuns: [...correctProof.workflowRuns, { id: 124, head_branch: "main", event: "push", status: "queued", conclusion: null }]
}).some((value) => value.includes("superseded")), "newer intended main run must supersede older proof");

const intendedBytes = Buffer.from("intended publication bytes");
const wrongBytes = Buffer.from("wrong live bytes");
const responseEntry = { path: "index.html", bytes: intendedBytes.length, sha256: sha256(intendedBytes) };
assert.deepEqual(intendedResponseErrors(responseEntry, { status: 200, bytes: intendedBytes }, sha256(Buffer.from("not found"))), []);
assert.ok(intendedResponseErrors(responseEntry, { status: 200, bytes: wrongBytes }, sha256(Buffer.from("not found"))).some((value) => value.includes("differs from inventory")), "wrong live bytes must fail");

console.log("Validated publication workflow and deployment-proof contracts");
