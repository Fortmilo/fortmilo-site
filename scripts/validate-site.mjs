import { readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const baseValidatorPath = path.join(scriptDirectory, "validate-site-base.mjs");
const effectiveValidatorPath = path.join(scriptDirectory, ".validate-site-effective.mjs");

let source = await readFile(baseValidatorPath, "utf8");

function replaceOnce(label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one baseline occurrence, found ${count}`);
  source = source.replace(before, after);
}

function replaceAllExact(label, before, after, expectedCount) {
  const count = source.split(before).length - 1;
  if (count !== expectedCount) throw new Error(`${label}: expected ${expectedCount} baseline occurrences, found ${count}`);
  source = source.split(before).join(after);
}

replaceOnce(
  "favicon SVG recorded hash",
  '["favicon.svg", "2dbc5023b718e959c69d27a42558b002b704399fb42d8b6298020fa5df97215c"]',
  '["favicon.svg", "24293f12640b0687bac3edb5e68289ab524a0ae344699244409ec58935bfd06c"]'
);

replaceOnce(
  "reference architecture SVG asset registration",
  '["assets/fortmilo-shield-512.png", "a39acef2c9e9dc76583ed60b4c4c1e59fe92c135a6295683edf080051d0fa980"]',
  '["assets/fortmilo-shield-512.png", "a39acef2c9e9dc76583ed60b4c4c1e59fe92c135a6295683edf080051d0fa980"],\n  ["documents/security-observatory-reference-architecture.svg", "ab068801bb71382624434df8a3e55b6eb728c37baa7f70cecacca87994807636"]'
);

replaceOnce(
  "homepage body hash",
  'const expectedHomepageBodyHash = "4bc037b4050e3981558ad2d0c2c21e152e89528cd8ee1f724071237952641e4e";',
  'const expectedHomepageBodyHash = "44a4641f7cdd3026cbcd202ee7229f20050b094dd921e4eca017eb73bda5295d";'
);

replaceOnce(
  "homepage corporate nav",
  `const homepageCorporateNav = '<nav class="corporate-nav" aria-label="Corporate navigation"><a aria-current="page" href="/">Home</a><a href="/security-observatory/">Security Observatory</a><a href="/architecture-security.html">Architecture & Security</a><a href="/contact.html">Contact</a></nav>';`,
  `const homepageCorporateNav = '<nav class="corporate-nav" aria-label="Corporate navigation"><a aria-current="page" href="/">Home</a><a href="/security-observatory/">Security Observatory</a><a href="/architecture-security.html">Architecture & Security</a><a href="/documents/">Documents</a></nav>';`
);

replaceOnce(
  "homepage evidence-boundary chip",
  'const homepageChips = ["Read-only", "No automatic remediation", "Evidence retained in your org"];',
  'const homepageChips = ["Read-only", "No automatic remediation", "Evidence retained in your org, with user-initiated export as an explicit boundary."];'
);

replaceOnce(
  "homepage retained-evidence differentiator",
  '["Evidence retained inside Salesforce", "Evidence collection, review and retained context remain within the subscriber organisation."],',
  '["Evidence retained inside Salesforce", "Automatic assessment and retained product evidence remain inside the subscriber organisation. A user-initiated sanitised CSV download is a separate export boundary."],'
);
replaceOnce(
  "homepage unavailable-evidence differentiator",
  '["Unavailable evidence stays explicit", "Blocked or incomplete sources remain Not assessed, with a reason and a safe next action. Missing evidence is not converted into zero."],',
  '["Unavailable evidence stays explicit", "Required sources that cannot be assessed remain Unavailable with a bounded reason and safe next action. Selected current zero and unavailable paths have test and controlled runtime evidence; universal environment support is not implied."],'
);
replaceOnce(
  "homepage sanitised-evidence differentiator",
  '["Sanitised evidence by design", "Evidence is presented without tokens, session identifiers, raw IP addresses, secrets, private keys, certificate bodies or credential values."],',
  '["Sanitised evidence by design", "The design excludes tokens, session identifiers, secrets, private keys, certificate bodies and credential values from retained review evidence. Complete raw-IP retained and export-shape validation remains environment-specific."],'
);

replaceOnce(
  "homepage illustrative evidence state",
  `const illustrativePanel = '<aside class="illustrative-evidence" aria-labelledby="illustrative-evidence-label"><p id="illustrative-evidence-label" class="evidence-label">Illustrative evidence state</p><dl><div><dt>State</dt><dd>Not assessed</dd></div><div><dt>Reason</dt><dd>The evidence source was unavailable or incomplete.</dd></div><div><dt>Next safe action</dt><dd>Review access to the required source, then rerun the scan.</dd></div></dl><footer>Illustrative example — no organisation data shown.</footer></aside>';`,
  `const illustrativePanel = '<aside class="illustrative-evidence" aria-labelledby="illustrative-evidence-label"><p id="illustrative-evidence-label" class="evidence-label">Illustrative evidence state</p><dl><div><dt>State</dt><dd>Unavailable</dd></div><div><dt>Reason</dt><dd>The required evidence source could not be assessed.</dd></div><div><dt>Next safe action</dt><dd>Review access to the required source, then rerun the scan.</dd></div></dl><footer>Illustrative example — no organisation data shown.</footer></aside>';`
);

replaceOnce(
  "Documents-only AI exception",
  '  if (/\\b(?:AI|GPT|Codex|Claude|Gemini)\\b/iu.test(html)) errors.push(`${route.output}: AI reference found`);',
  '  if (route.output !== "documents/index.html" && /\\b(?:AI|GPT|Codex|Claude|Gemini)\\b/iu.test(html)) errors.push(`${route.output}: AI reference found outside the authorised Documents-page exception`);'
);

replaceAllExact(
  "Evidence Semantics path version",
  "evidence-semantics-and-scanner-orchestration-v1.3",
  "evidence-semantics-and-scanner-orchestration-v1.4",
  2
);

replaceAllExact(
  "Evidence Semantics title version",
  "Evidence Semantics and Scanner Orchestration v1.3",
  "Evidence Semantics and Scanner Orchestration v1.4",
  1
);

replaceOnce(
  "homepage current-whitepaper route",
  '<a class="button button-primary" href="/documents/evidence-semantics-and-scanner-orchestration-v1.4.pdf">Read the technical whitepaper</a>',
  '<a class="button button-primary" href="/documents/">Read the current technical whitepaper</a>'
);

replaceOnce(
  "architecture current-whitepaper route",
  'for (const required of ["Technical whitepaper", whitepaperTitle, "Read the technical whitepaper"]) if (!architecture.includes(required)) errors.push(`architecture-security.html: missing ${required}`);\nif (!architecture.includes(`href="${whitepaperPath}"`)) errors.push("architecture-security.html: missing versioned technical whitepaper link");',
  'for (const required of ["Technical whitepaper", "Evidence Semantics and Scanner Orchestration", "Read the current technical whitepaper", "The Documents page identifies the current published version."]) if (!architecture.includes(required)) errors.push(`architecture-security.html: missing ${required}`);\nif (!architecture.includes(\'href="/documents/"\')) errors.push("architecture-security.html: missing current Documents whitepaper route");\nif (architecture.includes(whitepaperPath)) errors.push("architecture-security.html: direct versioned whitepaper link must route through Documents");'
);

const documentsCanonicalLine = 'if (!documents.includes(\'<link rel="canonical" href="https://fortmilo.co.uk/documents/">\')) errors.push("documents/index.html: incorrect canonical");';
const documentsPolicy = [
  documentsCanonicalLine,
  'const methodologyPaperPath = "/documents/orchestrating-ai-for-secure-software-delivery-v1.0.pdf";',
  'const methodologyPaperTitle = "Orchestrating AI for Secure Software Delivery v1.0";',
  'const methodologyPaperSubtitle = "A Security Observatory case study in human authority, evidence gates and multi-model engineering.";',
  'const documentsDescription = "Technical whitepapers and methodology material for Security Observatory by FortMilo.";',
  'if (!allFiles.includes(methodologyPaperPath.slice(1))) errors.push(`missing ${methodologyPaperPath.slice(1)}`);',
  'for (const required of ["Methodology paper", methodologyPaperTitle, methodologyPaperSubtitle, \'href="\' + methodologyPaperPath + \'"\', "Read the methodology paper"]) if (!documents.includes(required)) errors.push(`documents/index.html: missing authorised methodology-paper content ${required}`);',
  'if ((documents.match(/class="card technical-resource"/gu) || []).length !== 2) errors.push("documents/index.html: expected exactly two publication cards");',
  'if (!(documents.indexOf(whitepaperTitle) < documents.indexOf(methodologyPaperTitle))) errors.push("documents/index.html: Evidence Semantics must remain the primary publication before the methodology paper");',
  'if (!documents.includes(`<meta name="description" content="${documentsDescription}">`) || !documents.includes(`<meta property="og:description" content="${documentsDescription}">`)) errors.push("documents/index.html: incorrect Documents metadata description");',
  'const documentsOutsideAiException = documents.replace(methodologyPaperTitle, "").replace(methodologyPaperPath, "");',
  'if (/\\b(?:AI|GPT|Codex|Claude|Gemini)\\b/iu.test(documentsOutsideAiException)) errors.push("documents/index.html: AI content exceeds the single authorised methodology-paper title/path exception");'
].join("\n");

replaceOnce("Documents publication policy", documentsCanonicalLine, documentsPolicy);

const siteRoot = path.resolve(scriptDirectory, "..");
const evidencePagePath = path.join(siteRoot, "security-observatory", "evidence.html");
const evidencePage = await readFile(evidencePagePath, "utf8");
const evidencePageLower = evidencePage.toLowerCase();
for (const prohibited of [
  "formula-injection-safe",
  "safe export",
  "one export boundary, applied everywhere",
  "No risk evidence surfaced",
  "Unknown/Error"
]) {
  if (evidencePageLower.includes(prohibited.toLowerCase())) throw new Error(`security-observatory/evidence.html: prohibited public wording ${prohibited}`);
}
for (const required of [
  "None found",
  "Unavailable",
  "Not assessed",
  "Not retained at this evidence level",
  "Not captured",
  "Not applicable",
  "Release-status boundary",
  "A retained state is the point-in-time rendered state stored with a scan.",
  "Spreadsheet formula-trigger mitigation",
  "Each surface exports a fixed allow-list",
  "This applies to the reviewed export helper paths and the enumerated trigger characters.",
  "It is not a claim that every spreadsheet-injection technique or every export path is covered.",
  "Complete raw-IP retained and export-shape validation remains environment-specific"
]) {
  if (!evidencePage.includes(required)) throw new Error(`security-observatory/evidence.html: missing bounded evidence wording ${required}`);
}
if (!(evidencePage.indexOf("What a result does not mean") < evidencePage.indexOf("Current v1 SBS mapping"))) {
  throw new Error("security-observatory/evidence.html: conclusion-boundary block must precede SBS mapping statistics");
}

const homepage = await readFile(path.join(siteRoot, "index.html"), "utf8");
for (const required of [
  "<dt>State</dt><dd>Unavailable</dd>",
  "The required evidence source could not be assessed.",
  "Evidence retained in your org, with user-initiated export as an explicit boundary.",
  "A user-initiated sanitised CSV download is a separate export boundary.",
  'href="/documents/">Read the current technical whitepaper</a>',
  "Complete raw-IP retained and export-shape validation remains environment-specific."
]) {
  if (!homepage.includes(required)) throw new Error(`index.html: missing evidence-boundary wording ${required}`);
}
for (const prohibited of ["<dt>State</dt><dd>Not assessed</dd>", "No risk evidence surfaced", "Unknown/Error", "/documents/evidence-semantics-and-scanner-orchestration-v1.4.pdf"]) {
  if (homepage.includes(prohibited)) throw new Error(`index.html: prohibited evidence-state or stale whitepaper wording ${prohibited}`);
}

const architecture = await readFile(path.join(siteRoot, "architecture-security.html"), "utf8");
for (const required of [
  "Unavailable — bounded reason",
  "Reviewed current paths keep zero distinct",
  "Neither Unavailable nor Partial is a substitute for None found",
  "exact-candidate persona validation",
  'href="/documents/">Read the current technical whitepaper</a>'
]) {
  if (!architecture.includes(required)) throw new Error(`architecture-security.html: missing bounded evidence wording ${required}`);
}
for (const prohibited of ["Not assessed with a bounded reason", "UNAVAILABLE OR</text><text x=\"620\" y=\"385\">INCOMPLETE EVIDENCE</text><text x=\"857\" y=\"362\">NOT ASSESSED", "/documents/evidence-semantics-and-scanner-orchestration-v1.4.pdf"]) {
  if (architecture.includes(prohibited)) throw new Error(`architecture-security.html: obsolete state or stale whitepaper mapping ${prohibited}`);
}

const findings = await readFile(path.join(siteRoot, "security-observatory", "findings.html"), "utf8");
for (const prohibited of ["No risk evidence surfaced", "Unknown/Error"]) {
  if (findings.includes(prohibited)) throw new Error(`security-observatory/findings.html: obsolete evidence token ${prohibited}`);
}
for (const required of ["None found", "Unavailable", "Not retained at this evidence level", "Not captured"]) {
  if (!findings.includes(required)) throw new Error(`security-observatory/findings.html: missing canonical evidence token ${required}`);
}

const entitlements = await readFile(path.join(siteRoot, "security-observatory", "entitlements-assets.html"), "utf8");
if (entitlements.includes("FLS-gated controls")) throw new Error("security-observatory/entitlements-assets.html: unvalidated FLS-gated implementation claim returned");
if (!entitlements.includes("exact-candidate persona validation")) throw new Error("security-observatory/entitlements-assets.html: missing persona-validation boundary");

const identity = await readFile(path.join(siteRoot, "security-observatory", "identity-access.html"), "utf8");
if (identity.includes("without session IDs or raw IP values")) throw new Error("security-observatory/identity-access.html: universal raw-IP exclusion claim returned");
const identityRawIpCopy = "Raw IP values are omitted or redacted; exact retained-data shape is validated per environment.";
if ((identity.split(identityRawIpCopy).length - 1) !== 2) throw new Error("security-observatory/identity-access.html: expected customer-facing raw-IP boundary in intro and sessions card");
if (identity.includes("Raw-IP omission or redaction is a design boundary whose complete retained-data and export-shape validation remains environment-specific")) throw new Error("security-observatory/identity-access.html: internal evidence-register raw-IP wording returned");

await writeFile(effectiveValidatorPath, source, "utf8");
let status = 1;

try {
  const result = spawnSync(process.execPath, [effectiveValidatorPath], {
    cwd: siteRoot,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  status = result.status ?? 1;
} finally {
  await rm(effectiveValidatorPath, { force: true });
}

process.exit(status);
