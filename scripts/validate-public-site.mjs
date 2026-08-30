import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from "pdf-lib";
import { documentAssets, routes } from "../site-src/site-map.mjs";
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

function decodePdfString(value) {
  return value instanceof PDFString || value instanceof PDFHexString ? value.decodeText() : null;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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
const currentDocumentAssets = documentAssets.filter((asset) => asset.lastmod === currentPublicationDate);
if (sitemap.split(expectedLastmod).length - 1 !== indexed.length + currentDocumentAssets.length) {
  errors.push(`sitemap: expected ${indexed.length + currentDocumentAssets.length} lastmod values for ${currentPublicationDate}`);
}
for (const asset of documentAssets) {
  const entry = `<url><loc>${asset.canonical}</loc><lastmod>${asset.lastmod}</lastmod></url>`;
  if (!sitemap.includes(entry)) errors.push(`sitemap: missing document asset ${asset.canonical}`);
  if (!fileSet.has(asset.output)) errors.push(`site-map: missing document asset file ${asset.output}`);
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
if (documents.includes("Independent engineering research")) errors.push("documents/index.html: independent engineering research wording remains");
for (const value of [
  "Engineering methodology",
  "Fortmilo engineering-methodology publications",
  "Security Observatory is used as a bounded case study; no AI product capability is claimed for Security Observatory.",
  "<strong>Version</strong><span>1.0 accessible edition</span>",
  "<strong>Publication date</strong><span>30 August 2026</span>",
  'href="/documents/orchestrating-ai-for-secure-software-delivery.pdf">Read the accessible methodology paper</a>'
]) {
  if (!documents.includes(value)) errors.push(`documents/index.html: accessible methodology publication missing ${value}`);
}
if (/Security Observatory (?:has|includes|offers|uses) AI/iu.test(documents)) {
  errors.push("documents/index.html: Security Observatory is attributed an AI product capability");
}
if (!documents.includes('href="/documents/security-observatory-reference-architecture-v4.2.svg">View current reference architecture (v4.2)</a>')) {
  errors.push("documents/index.html: current reference architecture is not v4.2");
}
if (!documents.includes('href="/documents/security-observatory-reference-architecture-v4.1.svg">reference architecture v4.1</a>')) {
  errors.push("documents/index.html: historical v4.1 reference architecture link is missing");
}
for (const value of [
  "<strong>Author</strong><span>Luca Pacini</span>",
  "<strong>Publisher</strong><span>Fortmilo</span>",
  "<strong>Version</strong><span>v1.4</span>",
  "<strong>Publication date</strong><span>29 August 2026</span>",
  "<strong>Status</strong><span>Current</span>",
  'href="/documents/evidence-semantics-and-scanner-orchestration.pdf">Read current stable PDF (v1.4)</a>',
  'href="/documents/evidence-semantics-and-scanner-orchestration-v1.4.pdf">Open immutable v1.4 PDF</a>',
  '<strong>Superseded:</strong> <a href="/documents/evidence-semantics-and-scanner-orchestration-v1.3.pdf">v1.3, published 1 August 2026</a>'
]) {
  if (!documents.includes(value)) errors.push(`documents/index.html: missing whitepaper publication field ${value}`);
}

const currentWhitepaperPath = path.join(root, "documents", "evidence-semantics-and-scanner-orchestration.pdf");
const immutableWhitepaperPath = path.join(root, "documents", "evidence-semantics-and-scanner-orchestration-v1.4.pdf");
const historicalWhitepaperPath = path.join(root, "documents", "evidence-semantics-and-scanner-orchestration-v1.3.pdf");
const [currentWhitepaper, immutableWhitepaper, historicalWhitepaper] = await Promise.all([
  readFile(currentWhitepaperPath),
  readFile(immutableWhitepaperPath),
  readFile(historicalWhitepaperPath)
]);
if (sha256(currentWhitepaper) !== sha256(immutableWhitepaper)) {
  errors.push("whitepaper: stable current alias is not byte-identical to immutable v1.4");
}
if (sha256(historicalWhitepaper) !== "9e8a9faa5ad769bf7f34e7fccaa1524448b1ee690db49299519616ceb56d1804") {
  errors.push("whitepaper: restored historical v1.3 bytes do not match the promised Git-history edition");
}

const whitepaper = await PDFDocument.load(immutableWhitepaper, { updateMetadata: false });
if (whitepaper.getPageCount() !== 8) errors.push(`whitepaper v1.4: expected 8 pages, found ${whitepaper.getPageCount()}`);
for (const [label, actual, expected] of [
  ["title", whitepaper.getTitle(), "Evidence Semantics and Scanner Orchestration v1.4"],
  ["author", whitepaper.getAuthor(), "Luca Pacini"],
  ["subject", whitepaper.getSubject(), "Security Observatory evidence semantics, scanner planning and bounded licence-assignment retention"],
  ["creator", whitepaper.getCreator(), "Fortmilo document generation tooling"]
]) {
  if (actual !== expected) errors.push(`whitepaper v1.4: incorrect ${label} metadata`);
}
if (!whitepaper.getKeywords()?.includes("licence assignments")) errors.push("whitepaper v1.4: keywords metadata is incomplete");
if (decodePdfString(whitepaper.catalog.get(PDFName.of("Lang"))) !== "en-GB") errors.push("whitepaper v1.4: catalog language is not en-GB");
if (!whitepaper.catalog.get(PDFName.of("StructTreeRoot"))) errors.push("whitepaper v1.4: structure tree is missing");
const markInfo = whitepaper.catalog.lookupMaybe(PDFName.of("MarkInfo"), PDFDict);
if (markInfo?.get(PDFName.of("Marked"))?.toString() !== "true") errors.push("whitepaper v1.4: MarkInfo does not declare marked content");
if (!whitepaper.catalog.get(PDFName.of("Outlines"))) errors.push("whitepaper v1.4: bookmarks are missing");

const structureRoles = new Map();
const figureAlternatives = [];
const embeddedFonts = [];
for (const [, object] of whitepaper.context.enumerateIndirectObjects()) {
  if (!(object instanceof PDFDict)) continue;
  const role = object.get(PDFName.of("S"))?.toString();
  if (role) structureRoles.set(role, (structureRoles.get(role) || 0) + 1);
  if (role === "/Figure") figureAlternatives.push(decodePdfString(object.get(PDFName.of("Alt"))));
  if (object.get(PDFName.of("Type"))?.toString() !== "/Font") continue;
  const descriptor = object.lookupMaybe(PDFName.of("FontDescriptor"), PDFDict);
  if (descriptor) {
    embeddedFonts.push(Boolean(descriptor.get(PDFName.of("FontFile2")) || descriptor.get(PDFName.of("FontFile3"))));
  }
}
for (const role of ["/Document", "/H1", "/H2", "/H3", "/Table", "/TR", "/TH", "/TD", "/L", "/LI", "/Figure", "/Link"]) {
  if (!structureRoles.get(role)) errors.push(`whitepaper v1.4: semantic structure role ${role} is missing`);
}
if (figureAlternatives.length !== 1 || !figureAlternatives[0]?.includes("20-family scanner plan")) {
  errors.push("whitepaper v1.4: figure alternative text is missing or incorrect");
}
if (!embeddedFonts.length || embeddedFonts.some((embedded) => !embedded)) errors.push("whitepaper v1.4: one or more descriptor fonts are not embedded");

const linkUris = [];
for (const page of whitepaper.getPages()) {
  const annotations = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
  if (!annotations) continue;
  for (let index = 0; index < annotations.size(); index += 1) {
    const annotation = annotations.lookup(index, PDFDict);
    if (annotation.get(PDFName.of("Subtype"))?.toString() !== "/Link") continue;
    const action = annotation.lookupMaybe(PDFName.of("A"), PDFDict);
    const uri = decodePdfString(action?.get(PDFName.of("URI")));
    if (uri) linkUris.push(uri);
  }
}
for (const uri of [
  "https://github.com/Fortmilo/fortmilo-site/blob/main/EVIDENCE_TERMINOLOGY_CONTRACT_V1.1.md",
  "https://fortmilo.co.uk/security-observatory/",
  "https://fortmilo.co.uk/documents/security-observatory-reference-architecture-v4.2.svg",
  "https://creativecommons.org/licenses/by/4.0/"
]) {
  if (!linkUris.includes(uri)) errors.push(`whitepaper v1.4: hyperlink annotation missing ${uri}`);
}

const whitepaperSource = await readFile(path.join(root, "document-src", "evidence-semantics-and-scanner-orchestration-v1.4.html"), "utf8");
for (const claim of [
  "The same 20-family scanner plan runs at Top Issues, Balanced and Everything.",
  "Package Licences",
  "Permission Set Licences",
  "Salesforce User Licences",
  "The retained-row maximum remains 1,000 per family, never 1,001.",
  "The theoretical maximum across all three families is therefore <strong>3,000 retained assignment rows per scan</strong>.",
  "Zero captured is never enough to claim zero assignments.",
  "When expected is unknown, leave it unknown.",
  "sandbox-first",
  "not yet available for public installation",
  "Managed 2GP package creation, installation, upgrade and subscriber-org behaviour are not proved",
  "Source review and document generation are not runtime proof."
]) {
  if (!whitepaperSource.includes(claim)) errors.push(`whitepaper source v1.4: missing material claim ${claim}`);
}
if (whitepaperSource.includes("The front-matter fields are reference data")) errors.push("whitepaper source v1.4: drafting note remains");

const historicalReferenceSvg = await readFile(path.join(root, "documents/security-observatory-reference-architecture-v4.1.svg"), "utf8");
if (!historicalReferenceSvg.includes('<title id="soTitle">Security Observatory — reference architecture</title>')) {
  errors.push("historical reference architecture v4.1: accessible title changed");
}
const referenceSvg = await readFile(path.join(root, "documents/security-observatory-reference-architecture-v4.2.svg"), "utf8");
if (!referenceSvg.includes('<title id="soTitle">Security Observatory — reference architecture v4.2</title>')) {
  errors.push("reference architecture v4.2: accessible title is not canonical");
}
if (referenceSvg.includes("Security Observatory by Fortmilo")) {
  errors.push("reference architecture v4.2: routine compound title remains");
}
for (const message of namingErrors(referenceSvg, "documents/security-observatory-reference-architecture-v4.2.svg")) {
  errors.push(`reference architecture v4.2: ${message}`);
}
for (const message of evidenceTerminologyErrors(referenceSvg)) {
  errors.push(`reference architecture v4.2: ${message}`);
}

function xmlText(value) {
  return value
    .replace(/<[^>]+>/gu, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replace(/\s+/gu, " ")
    .trim();
}

const descMatch = /<desc\b[^>]*>([\s\S]*?)<\/desc>/u.exec(referenceSvg);
const visibleReferenceText = [...referenceSvg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gu)]
  .map((match) => xmlText(match[1]))
  .join(" ")
  .replace(/\s+/gu, " ")
  .trim();
const accessibleReferenceText = descMatch ? xmlText(descMatch[1]) : "";
if (!descMatch) errors.push("reference architecture v4.2: accessible description is missing");

const materialReferenceClaims = [
  "No automated evidence transmission to Fortmilo or third-party services.",
  "No security remediation or write-back to assessed Salesforce configuration.",
  "Server-side collection and retention occur in the subscriber Salesforce organisation.",
  "LWC JavaScript prepares the allow-listed CSV in the authenticated browser session.",
  "Downloading creates a local file outside Salesforce.",
  "The customer controls storage, sharing and onward handling.",
  "No persisted Salesforce CSV artefact is asserted.",
  "Raw IP values are omitted or redacted; exact retained-data and export shape remains subject to validation per environment and reviewed path.",
  "Contextual metric or finding label",
  "None found",
  "Unavailable",
  "Not assessed",
  "Not retained at this evidence level",
  "Not captured",
  "Not applicable",
  "The contextual label is bounded by the retained usable evidence.",
  "These are evidence states, not compliance or pass/fail decisions.",
  "Partial is a completeness qualifier, not a rendered evidence state.",
  "Licence-assignment capture status",
  "Incomplete is not a rendered evidence state.",
  "Coverage varies by release.",
  "Salesforce package architecture; delivery and validated coverage remain release-specific.",
  "Any remediation decision and action remains with the owner.",
  "Fortmilo operates no hosted evidence service or automated telemetry ingestion.",
  "Reference architecture only; managed 2GP installation proof and public availability are not asserted.",
  "v4.1 remains published as a historical architecture."
];
for (const claim of materialReferenceClaims) {
  if (!visibleReferenceText.includes(claim)) errors.push(`reference architecture v4.2: visible text missing material claim ${claim}`);
  if (!accessibleReferenceText.includes(claim)) errors.push(`reference architecture v4.2: <desc> missing material claim ${claim}`);
}
if (visibleReferenceText.includes("1,000") || accessibleReferenceText.includes("1,000")) {
  errors.push("reference architecture v4.2: numeric licence-assignment limit should remain in maintained Product boundaries");
}
for (const match of referenceSvg.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gu)) {
  const value = match[1];
  if (/^(?:https?:|mailto:|tel:|#|data:)/u.test(value)) continue;
  const target = resolvePublicPath(value);
  if (!fileSet.has(target)) errors.push(`reference architecture v4.2: broken internal reference ${value}`);
}
if (!referenceSvg.includes('href="/security-observatory/"')) {
  errors.push("reference architecture v4.2: maintained Product boundaries link is missing");
}

for (const image of allFiles.filter((file) => /\.(?:png|jpe?g|ico|svg)$/iu.test(file))) {
  if ((await stat(path.join(root, image))).size === 0) errors.push(`${image}: empty image asset`);
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`Validated ${routes.length} routes, ${indexed.length} indexed pages, ${documentAssets.length} whitepaper URLs, links, PDF structure/fonts/metadata and reference architecture`);
