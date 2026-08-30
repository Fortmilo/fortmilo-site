import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiVersion = "2026-03-10";

function isCurrentRunStatus(status, workflowRunId) {
  if (status?.state !== "success" || typeof status.log_url !== "string") return false;
  try {
    return new URL(status.log_url).pathname.includes(`/actions/runs/${workflowRunId}`);
  } catch {
    return false;
  }
}

function isNewerIntendedMainRun(run, workflowRunId) {
  if (!run || Number(run.id) <= Number(workflowRunId)) return false;
  if (run.head_branch !== "main" || !["push", "workflow_dispatch"].includes(run.event)) return false;
  return run.status !== "completed" || !["cancelled", "failure", "skipped"].includes(run.conclusion);
}

function newestMatchingDeployment(deployments, requestedSha) {
  return (deployments || [])
    .filter((deployment) => deployment.sha?.toLowerCase() === requestedSha && deployment.ref === "main" && deployment.environment === "github-pages")
    .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")) || Number(right.id) - Number(left.id))[0];
}

export function deploymentProofErrors({
  requestedSha,
  githubRef,
  workflowRunId,
  pagesStatus,
  deployments,
  statusesByDeployment,
  workflowRuns
}) {
  const errors = [];
  const requested = String(requestedSha || "").toLowerCase();
  if (!/^[a-f0-9]{40}$/u.test(requested)) errors.push("requested SHA must be a full 40-character commit SHA");
  if (githubRef !== "refs/heads/main") errors.push(`production deployment ref must be refs/heads/main, found ${githubRef}`);
  if (!/^\d+$/u.test(String(workflowRunId || ""))) errors.push("workflow run ID must be numeric");
  if (pagesStatus?.status !== "succeed") errors.push(`Pages deployment ${requested} did not report succeed`);

  const newestDeployment = newestMatchingDeployment(deployments, requested);
  if (!newestDeployment) {
    errors.push(`no github-pages deployment exists for SHA ${requested} on main`);
  } else if (!(statusesByDeployment.get(newestDeployment.id) || []).some((status) => isCurrentRunStatus(status, workflowRunId))) {
    errors.push(`newest github-pages deployment for SHA ${requested} is not a successful deployment from workflow run ${workflowRunId}`);
  }

  const newerRuns = (workflowRuns || []).filter((run) => isNewerIntendedMainRun(run, workflowRunId));
  if (newerRuns.length) errors.push(`workflow run ${workflowRunId} is superseded by newer intended main run(s): ${newerRuns.map((run) => run.id).join(", ")}`);

  return errors;
}

export function sanitisedDeploymentEvidence({ requestedSha, deployedSha, workflowRunId, inventoryDigest }) {
  return Object.freeze({
    requestedSha: requestedSha.toLowerCase(),
    deployedSha: deployedSha.toLowerCase(),
    workflowRunId: String(workflowRunId),
    inventoryDigest: inventoryDigest.toLowerCase()
  });
}

function parseArguments(arguments_) {
  const options = {};
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--requested-sha") options.requestedSha = arguments_[++index];
    else if (argument === "--inventory-digest") options.inventoryDigest = arguments_[++index];
    else if (argument === "--workflow-run-id") options.workflowRunId = arguments_[++index];
    else if (argument === "--output") options.output = arguments_[++index];
    else throw new Error(`unknown argument: ${argument}`);
  }
  if (!/^[a-f0-9]{40}$/iu.test(options.requestedSha || "")) throw new Error("--requested-sha must be a full commit SHA");
  if (!/^[a-f0-9]{64}$/iu.test(options.inventoryDigest || "")) throw new Error("--inventory-digest must be a SHA-256 digest");
  if (!/^\d+$/u.test(options.workflowRunId || "")) throw new Error("--workflow-run-id must be numeric");
  if (!options.output) throw new Error("--output is required");
  return options;
}

async function githubApi(repository, token, endpoint) {
  const response = await fetch(`https://api.github.com/repos/${repository}${endpoint}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": apiVersion,
      "User-Agent": "fortmilo-publication-integrity"
    },
    redirect: "error",
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`GitHub API ${endpoint.split("?", 1)[0]} returned ${response.status}`);
  return response.json();
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const githubRef = process.env.GITHUB_REF;
  if (!repository || !/^[^/]+\/[^/]+$/u.test(repository)) throw new Error("GITHUB_REPOSITORY is required");
  if (!token) throw new Error("GITHUB_TOKEN is required");

  const requestedSha = options.requestedSha.toLowerCase();
  const [pagesStatus, deployments, workflowRunResponse] = await Promise.all([
    githubApi(repository, token, `/pages/deployments/${requestedSha}`),
    githubApi(repository, token, `/deployments?sha=${requestedSha}&environment=github-pages&per_page=100`),
    githubApi(repository, token, "/actions/workflows/deploy-pages.yml/runs?branch=main&per_page=100")
  ]);
  const statusesByDeployment = new Map();
  await Promise.all(deployments.map(async (deployment) => {
    statusesByDeployment.set(deployment.id, await githubApi(repository, token, `/deployments/${deployment.id}/statuses?per_page=100`));
  }));

  const errors = deploymentProofErrors({
    requestedSha,
    githubRef,
    workflowRunId: options.workflowRunId,
    pagesStatus,
    deployments,
    statusesByDeployment,
    workflowRuns: workflowRunResponse.workflow_runs
  });
  if (errors.length) throw new Error(errors.join("; "));

  const deployedSha = newestMatchingDeployment(deployments, requestedSha).sha;
  const evidence = sanitisedDeploymentEvidence({ requestedSha, deployedSha, workflowRunId: options.workflowRunId, inventoryDigest: options.inventoryDigest });
  await writeFile(options.output, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(`Deployment SHA proof passed for ${evidence.requestedSha}, workflow run ${evidence.workflowRunId}, inventory ${evidence.inventoryDigest}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}
