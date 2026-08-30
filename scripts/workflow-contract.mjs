export function deploymentEventErrors({ ref, eventName, defaultBranch }) {
  const errors = [];
  if (ref !== "refs/heads/main") errors.push("production deployment requires refs/heads/main");
  if (defaultBranch !== "main") errors.push("production deployment requires main as the repository default branch");
  if (!["push", "workflow_dispatch"].includes(eventName)) errors.push(`unsupported production deployment event ${eventName}`);
  return errors;
}

function occurrences(value, pattern) {
  return [...value.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))].length;
}

export function workflowContractErrors(workflows) {
  const errors = [];
  const combined = [...workflows.values()].join("\n");
  const deployment = workflows.get("deploy-pages.yml") || "";

  if (occurrences(combined, /actions\/deploy-pages@/u) !== 1) errors.push("exactly one actions/deploy-pages production path is required");
  if (occurrences(combined, /actions\/upload-pages-artifact@/u) !== 1) errors.push("exactly one actions/upload-pages-artifact production path is required");
  if (/request-pages-build|\/pages\/builds/iu.test(combined)) errors.push("legacy Pages build requests are prohibited");
  if (occurrences(deployment, /group:\s*pages-production\s*$/mu) !== 1) errors.push("exactly one pages-production concurrency group is required");
  if (!/cancel-in-progress:\s*false\s*$/mu.test(deployment)) errors.push("production concurrency must serialize runs without cancellation-based proof");
  if (!/push:\s*[\s\S]*?branches:\s*[\s\S]*?- main/u.test(deployment)) errors.push("deployment push trigger must be limited to main");
  if (!/workflow_dispatch:/u.test(deployment)) errors.push("deployment workflow_dispatch trigger is missing");
  if (occurrences(deployment, /if:\s*github\.ref == 'refs\/heads\/main' && github\.event\.repository\.default_branch == 'main'/u) < 1) {
    errors.push("feature-branch and non-default-branch deployment guard is missing");
  }
  if (!/git rev-parse HEAD/u.test(deployment) || !/GITHUB_SHA/u.test(deployment)) errors.push("checkout HEAD equality proof is missing");
  for (const token of ["verified_sha", "inventory_digest", "inventory_file_sha256"]) {
    if (!deployment.includes(token)) errors.push(`workflow evidence output ${token} is missing`);
  }
  if (!deployment.includes("scripts/deployment-proof.mjs")) errors.push("post-deploy GitHub API SHA proof is missing");
  if (!deployment.includes("verify:publication:http")) errors.push("post-deploy full HTTP verification is missing");
  if (!deployment.includes("actions/upload-artifact@")) errors.push("sanitised workflow evidence is not retained");
  return errors;
}
