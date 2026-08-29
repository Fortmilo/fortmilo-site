import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routes } from "../site-src/site-map.mjs";
import {
  deploymentTriggerPublicationDateErrors,
  evidenceTerminologyErrors,
  headingErrors,
  namingErrors,
  publicCopyRevisionErrors
} from "./public-site-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const currentPublicationDate = "2026-08-29";
const errors = [];

async function walk(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), relative));
    else files.push(relative);
  }
  return files;
}

function resolvePublicPath(value) {
  const clean = value.split("#", 1)[0].split("?", 1)[0];
  if (!clean || clean === "/") return "index.html";
  const relative = clean.startsWith("/") ? clean.slice(1) : clean;
  return relative.endsWith("/") ? `${relative}index.html` : relative;
}

const allFiles = await walk(root);
const fileSet = new Set(allFiles);

if (routes.length !== 14) errors.push(`expected 14 declared routes, found ${routes.length}`);

for (const route of routes) {
  const file = path.join(root, route.output);
  let html = "";
  try {
    html = await readFile(file, "utf8");
  } catch {
    errors.push(`${route.output}: missing route file`);
    continue;
  }

  if (!html.startsWith("<!doctype html>")) errors.push(`${route.output}: missing HTML5 doctype`);
  if (!html.includes('<html lang="en-GB">')) errors.push(`${route.output}: missing en-GB language`);
  if (!html.includes('<a class="skip-link" href="#main">Skip to content</a>')) errors.push(`${route.output}: missing skip link`);

  if (route.noindex) {
    if (!html.includes('<meta name="robots" content="noindex">')) errors.push(`${route.output}: missing noindex`);
    if (html.includes('<link rel="canonical"')) errors.push(`${route.output}: noindex page must not declare canonical`);
  } else if (!html.includes(`<link rel="canonical" href="${route.canonical}">`)) {
    errors.push(`${route.output}: incorrect canonical`);
  }

  const footer = /<footer class="site-footer">[\s\S]*?<\/footer>/u.exec(html)?.[0] || "";
  for (const required of [
    'href="/contact.html">Contact</a>',
    'href="/acknowledgements.html">Acknowledgements</a>',
    'href="/privacy.html">Privacy</a>',
    'href="/terms.html">Terms</a>',
    'href="/documents/">Technical whitepaper</a>',
    'href="/.well-known/security.txt">Security</a>'
  ]) {
    if (!footer.includes(required)) errors.push(`${route.output}: footer missing ${required}`);
  }

  for (const message of headingErrors(html)) errors.push(`${route.output}: ${message}`);
  for (const message of namingErrors(html, route.output)) errors.push(`${route.output}: ${message}`);
  for (const message of evidenceTerminologyErrors(html)) errors.push(`${route.output}: ${message}`);
  for (const message of publicCopyRevisionErrors(html, currentPublicationDate)) errors.push(`${route.output}: ${message}`);

  if (/<form\b/iu.test(html)) errors.push(`${route.output}: unexpected form`);
  if (/google-analytics|googletagmanager|segment\.com|mixpanel|hotjar/iu.test(html)) errors.push(`${route.output}: analytics/tracking reference found`);

  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/gu)) {
    const value = match[1];
    if (/^(?:https?:|mailto:|tel:|#|data:)/u.test(value)) continue;
    const target = resolvePublicPath(value);
    if (!fileSet.has(target)) errors.push(`${route.output}: broken internal reference ${value}`);
  }
}

const indexed = routes.filter((route) => !route.noindex);
if (indexed.some((route) => route.lastmod !== currentPublicationDate)) {
  errors.push(`site-map: every indexed route must have lastmod ${currentPublicationDate}`);
}

const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
const expectedLastmod = `<lastmod>${currentPublicationDate}</lastmod>`;
if (sitemap.split(expectedLastmod).length - 1 !== indexed.length) {
  errors.push(`sitemap: expected ${indexed.length} lastmod values for ${currentPublicationDate}`);
}

const deploymentTrigger = await readFile(path.join(root, "pages-deployment-trigger.txt"), "utf8");
for (const message of deploymentTriggerPublicationDateErrors(deploymentTrigger, currentPublicationDate)) {
  errors.push(`pages-deployment-trigger.txt: ${message}`);
}

const home = await readFile(path.join(root, "index.html"), "utf8");
if (!home.includes("Request access when available")) errors.push("index.html: missing access request CTA");
const overview = await readFile(path.join(root, "security-observatory/index.html"), "utf8");
for (const value of ["<h1>Security Observatory</h1>", "Five review areas", "Request access when available"]) {
  if (!overview.includes(value)) errors.push(`security-observatory/index.html: missing ${value}`);
}
const req063 = "<strong>Licence assignment evidence:</strong> in V1, each scan retains up to 1,000 assignment evidence records for each of the three licence families — Package Licences, Permission Set Licences and Salesforce User Licences — so at most 3,000 across those families per scan. This limits retained evidence only; it does not limit how many Salesforce users, licences or assignments your org can have. Where the full population cannot be retained safely, that evidence is reported as Incomplete rather than shown as complete.";
if (overview.split(req063).length - 1 !== 1) errors.push("security-observatory/index.html: REQ-063 disclosure must appear exactly once");
if (!overview.includes('<section class="term-card prose" aria-label="Licence-assignment retention disclosure"')) {
  errors.push("security-observatory/index.html: REQ-063 disclosure must use its dedicated semantic block");
}
if ((overview.match(/<strong>Licence assignment evidence:<\/strong>/gu) || []).length !== 1) {
  errors.push("security-observatory/index.html: visible REQ-063 disclosure label must appear exactly once");
}
const evidence = await readFile(path.join(root, "security-observatory/evidence.html"), "utf8");
for (const value of ["Current Evidence Terminology Contract", "Canonical v1.1", "Frozen v1.0", "Licence-assignment capture status", "evidence detail level"]) {
  if (!evidence.includes(value)) errors.push(`security-observatory/evidence.html: missing ${value}`);
}
if (/evidence depth/iu.test(evidence)) errors.push("security-observatory/evidence.html: obsolete evidence depth wording remains");
const same20FamilyRule = "The same 20-family scanner plan runs at Top Issues, Balanced and Everything. The selected evidence detail level changes what safe detail is retained, displayed, compared and exported; it does not change which scanner families are planned. Everything is the deepest supported level, not exhaustive or unlimited.";
if (!evidence.includes(same20FamilyRule)) errors.push("security-observatory/evidence.html: missing same 20-family scanner-plan rule");
const coverageRule = "Coverage type describes how far available evidence can assess the mapped question. It is neither confidence nor the selected evidence detail level.";
if (!evidence.includes(coverageRule)) errors.push("security-observatory/evidence.html: missing Coverage-axis rule");
const coverageTileRule = "Coverage tiles, including Partial Evidence, remain separate from control-outcome tiles and filters.";
if (!evidence.includes(coverageTileRule)) errors.push("security-observatory/evidence.html: missing Coverage-tile separation rule");
const completenessRules = [
  "Not assessed: work not performed or outside assessed scope",
  "Unavailable: required attempted source inaccessible or unusable",
  "Not retained at this evidence level: detail intentionally not retained",
  "Not captured: product intentionally does not capture that detail",
  "Incomplete: separate licence-assignment capture status for bounded or truncated capture"
];
const findings = await readFile(path.join(root, "security-observatory/findings.html"), "utf8");
for (const [route, html] of [["security-observatory/evidence.html", evidence], ["security-observatory/findings.html", findings]]) {
  for (const value of completenessRules) {
    if (!html.includes(value)) errors.push(`${route}: missing completeness boundary ${value}`);
  }
}
const contractV11 = await readFile(path.join(root, "EVIDENCE_TERMINOLOGY_CONTRACT_V1.1.md"), "utf8");
for (const message of evidenceTerminologyErrors(contractV11)) errors.push(`EVIDENCE_TERMINOLOGY_CONTRACT_V1.1.md: ${message}`);
for (const value of [
  "| **Not assessed** | The question was not assessed for the run or assessed scope. |",
  "**Incomplete** — the full licence-assignment population could not be retained safely. The captured count may be lower than expected or zero when safe Salesforce transaction/DML headroom is exhausted.",
  "Zero captured must not be inferred as zero assignments and must not be shown as Complete.",
  "When the expected count is unknown, the unknown expected count remains unknown.",
  "Incomplete remains a separate licence-assignment capture status, not a rendered evidence state.",
  coverageRule,
  "**Partial Evidence** is always Coverage, never an outcome or evidence state.",
  same20FamilyRule
]) {
  if (!contractV11.includes(value)) errors.push(`EVIDENCE_TERMINOLOGY_CONTRACT_V1.1.md: missing ${value}`);
}
const architecture = await readFile(path.join(root, "architecture-security.html"), "utf8");
if (!architecture.includes("<strong>Read-only assessment</strong><span>No security remediation or write-back to assessed Salesforce configuration.</span>")) {
  errors.push("architecture-security.html: incorrect read-only assessment boundary");
}
const csvTrustBoundary = "Collection and retention occur inside the subscriber Salesforce organisation. The LWC prepares the allow-listed CSV in the authenticated browser session; downloading it creates a file outside Salesforce.";
if (!architecture.includes(csvTrustBoundary)) errors.push("architecture-security.html: incorrect CSV trust boundary");
const documents = await readFile(path.join(root, "documents/index.html"), "utf8");
if ((documents.match(/not product documentation/giu) || []).length !== 0) {
  errors.push("documents/index.html: duplicate item-level product-documentation disclaimer remains");
}
if (!documents.includes("are not Security Observatory product documentation")) {
  errors.push("documents/index.html: section-level product-documentation disclaimer missing");
}

const referenceSvg = await readFile(path.join(root, "documents/security-observatory-reference-architecture-v4.1.svg"), "utf8");
if (!referenceSvg.includes('<title id="soTitle">Security Observatory — reference architecture</title>')) {
  errors.push("reference architecture: accessible title is not canonical");
}
if (referenceSvg.includes("Security Observatory by Fortmilo")) {
  errors.push("reference architecture: routine compound title remains");
}

for (const image of allFiles.filter((file) => /\.(?:png|jpe?g|ico|svg)$/iu.test(file))) {
  if ((await stat(path.join(root, image))).size === 0) errors.push(`${image}: empty image asset`);
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`Validated ${routes.length} routes, ${indexed.length} indexed lastmod values, shared footer, headings, naming, metadata, links and reference architecture`);
