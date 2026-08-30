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
const successfulCurrentRunStatus = {
  id: 100,
  created_at: "2026-08-30T10:00:00Z",
  state: "success",
  log_url: "https://github.com/Fortmilo/fortmilo-site/actions/runs/123/job/456"
};
const correctStatuses = new Map([[17, [successfulCurrentRunStatus]]]);
const correctProof = {
  requestedSha,
  githubRef: "refs/heads/main",
  workflowRunId: "123",
  pagesStatus: { status: "succeed" },
  deployments: [correctDeployment],
  statusesByDeployment: correctStatuses,
  workflowRuns: [{ id: 123, head_branch: "main", event: "push", status: "in_progress", conclusion: null }]
};
assert.deepEqual(deploymentProofErrors(correctProof), [], "exact run 123 must match run 123");
assert.ok(deploymentProofErrors({
  ...correctProof,
  statusesByDeployment: new Map([[17, [{ ...successfulCurrentRunStatus, log_url: "https://github.com/Fortmilo/fortmilo-site/actions/runs/1234/job/456" }]]])
}).length, "run 123 must not match run 1234");

const olderSuccessfulStatus = { ...successfulCurrentRunStatus, id: 98, created_at: "2026-08-30T09:00:00Z" };
const newerInactiveStatus = { ...successfulCurrentRunStatus, id: 99, created_at: "2026-08-30T11:00:00Z", state: "inactive" };
const inactiveLatestProof = {
  ...correctProof,
  statusesByDeployment: new Map([[17, [olderSuccessfulStatus, newerInactiveStatus]]])
};
const reversedInactiveLatestProof = {
  ...correctProof,
  statusesByDeployment: new Map([[17, [newerInactiveStatus, olderSuccessfulStatus]]])
};
assert.ok(deploymentProofErrors(inactiveLatestProof).length, "a newer inactive status must override an older success");
assert.deepEqual(deploymentProofErrors(inactiveLatestProof), deploymentProofErrors(reversedInactiveLatestProof), "input status order must not affect the result");
assert.ok(deploymentProofErrors({
  ...correctProof,
  statusesByDeployment: new Map([[17, [olderSuccessfulStatus, { ...newerInactiveStatus, state: "failure" }]]])
}).length, "a newer failure status must override an older success");
assert.ok(deploymentProofErrors({
  ...correctProof,
  statusesByDeployment: new Map([[17, [
    olderSuccessfulStatus,
    { ...olderSuccessfulStatus, id: 99, state: "failure" }
  ]]])
}).length, "the higher numeric status ID must break a created_at tie");
assert.deepEqual(deploymentProofErrors({
  ...correctProof,
  statusesByDeployment: new Map([[17, [{ ...olderSuccessfulStatus, state: "failure" }, successfulCurrentRunStatus]]])
}), [], "a latest success from the exact current run must pass");
assert.ok(deploymentProofErrors({
  ...correctProof,
  statusesByDeployment: new Map([[17, [{ ...successfulCurrentRunStatus, log_url: "not a URL" }]]])
}).length, "a malformed log URL must fail");
assert.ok(deploymentProofErrors({
  ...correctProof,
  statusesByDeployment: new Map([[17, [{ ...successfulCurrentRunStatus, log_url: "https://example.com/Fortmilo/fortmilo-site/actions/runs/123/job/456" }]]])
}).length, "a wrong-host log URL must fail");
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
