import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routes } from "../site-src/site-map.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

async function readText(relative) {
  try {
    return await readFile(path.join(root, relative), "utf8");
  } catch {
    errors.push(`missing ${relative}`);
    return "";
  }
}

function count(text, token) {
  return text.split(token).length - 1;
}

function extract(text, startToken, endToken, label) {
  const start = text.indexOf(startToken);
  if (start < 0) {
    errors.push(`${label}: missing start marker`);
    return "";
  }
  const end = text.indexOf(endToken, start + startToken.length);
  if (end < 0) {
    errors.push(`${label}: missing end marker`);
    return "";
  }
  return text.slice(start, end);
}

function mainOf(html) {
  return /<main\b[\s\S]*?<\/main>/u.exec(html)?.[0] || "";
}

function resolvePublicPath(value) {
  const clean = value.split("#", 1)[0].split("?", 1)[0];
  if (!clean || clean === "/") return "index.html";
  const relative = clean.startsWith("/") ? clean.slice(1) : clean;
  return relative.endsWith("/") ? `${relative}index.html` : relative;
}

function requireAll(text, values, label) {
  for (const value of values) {
    if (!text.includes(value)) errors.push(`${label}: missing ${value}`);
  }
}

function prohibitAll(text, values, label) {
  for (const value of values) {
    if (text.toLowerCase().includes(value.toLowerCase())) errors.push(`${label}: prohibited ${value}`);
  }
}

const allFiles = await walk(root);
const fileSet = new Set(allFiles);
const htmlByRoute = new Map();

for (const route of routes) {
  const html = await readText(route.output);
  htmlByRoute.set(route.output, html);
  if (!html) continue;

  if (!html.startsWith("<!doctype html>")) errors.push(`${route.output}: missing HTML5 doctype`);
  if (!html.includes('<html lang="en-GB">')) errors.push(`${route.output}: missing en-GB language`);
  requireAll(html, [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<a class="skip-link" href="#main">Skip to content</a>',
    '<link rel="manifest" href="/site.webmanifest">'
  ], route.output);

  if (route.noindex) {
    if (!html.includes('<meta name="robots" content="noindex">')) errors.push(`${route.output}: missing noindex`);
    if (html.includes('<link rel="canonical"')) errors.push(`${route.output}: noindex page must not declare canonical`);
  } else if (!html.includes(`<link rel="canonical" href="${route.canonical}">`)) {
    errors.push(`${route.output}: incorrect canonical`);
  }

  const ids = [...html.matchAll(/\bid="([^"]+)"/gu)].map((match) => match[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicates.length) errors.push(`${route.output}: duplicate ids ${duplicates.join(", ")}`);

  const stylesheetMatches = [...html.matchAll(/<link rel="stylesheet" href="\/(assets\/site\.[a-f0-9]{12}\.css)">/gu)];
  if (stylesheetMatches.length !== 1) errors.push(`${route.output}: expected one generated stylesheet reference`);

  const corporateNav = /<nav class="corporate-nav"[\s\S]*?<\/nav>/u.exec(html)?.[0] || "";
  if (!corporateNav.includes('href="/documents/">Documents</a>')) errors.push(`${route.output}: corporate navigation must include Documents`);
  if (corporateNav.includes('href="/contact.html">Contact</a>')) errors.push(`${route.output}: Contact must not replace Documents in corporate navigation`);

  const footer = /<footer class="site-footer">[\s\S]*?<\/footer>/u.exec(html)?.[0] || "";
  requireAll(footer, [
    'href="/contact.html">Contact</a>',
    'href="/privacy.html">Privacy</a>',
    'href="/terms.html">Terms</a>',
    'href="/documents/">Technical whitepaper</a>',
    'href="/acknowledgements.html">Acknowledgements</a>',
    'href="/.well-known/security.txt">Security</a>',
    "FortMilo is a Salesforce Partner.",
    "Security Observatory is independently developed and is not endorsed by Salesforce, Inc.",
    "Salesforce is a trademark of Salesforce, Inc."
  ], `${route.output} footer`);

  if (/<form\b/iu.test(html)) errors.push(`${route.output}: unexpected form`);
  if (/google-analytics|googletagmanager|segment\.com|mixpanel|hotjar/iu.test(html)) errors.push(`${route.output}: analytics/tracking reference found`);
  if (route.output !== "documents/index.html" && /\b(?:GPT|Codex|Claude|Gemini)\b/iu.test(html)) errors.push(`${route.output}: unauthorised AI-system reference`);

  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/gu)) {
    const value = match[1];
    if (/^(?:https?:|mailto:|tel:|#|data:)/u.test(value)) continue;
    const target = resolvePublicPath(value);
    if (!fileSet.has(target)) errors.push(`${route.output}: broken internal reference ${value} -> ${target}`);
  }
}

const cssFiles = allFiles.filter((file) => /^assets\/site\.[a-f0-9]{12}\.css$/u.test(file));
if (cssFiles.length !== 1) errors.push(`expected one generated shared CSS file, found ${cssFiles.length}`);
const sourceCss = await readText("site-src/styles.css");
if (cssFiles.length === 1) {
  const generatedCss = await readText(cssFiles[0]);
  if (generatedCss !== sourceCss) errors.push(`${cssFiles[0]} does not match site-src/styles.css`);
  const expectedHash = createHash("sha256").update(generatedCss).digest("hex").slice(0, 12);
  const actualHash = cssFiles[0].match(/^assets\/site\.([a-f0-9]{12})\.css$/u)?.[1];
  if (actualHash !== expectedHash) errors.push(`${cssFiles[0]}: filename hash does not match content digest ${expectedHash}`);
}

const homeCssFiles = allFiles.filter((file) => /^assets\/home\.[a-f0-9]{12}\.css$/u.test(file));
if (homeCssFiles.length !== 1) errors.push(`expected one generated home CSS file, found ${homeCssFiles.length}`);
const homeSourceCss = await readText("site-src/home.css");
if (homeCssFiles.length === 1) {
  const generatedHomeCss = await readText(homeCssFiles[0]);
  if (generatedHomeCss !== homeSourceCss) errors.push(`${homeCssFiles[0]} does not match site-src/home.css`);
  const expectedHomeHash = createHash("sha256").update(generatedHomeCss).digest("hex").slice(0, 12);
  const actualHomeHash = homeCssFiles[0].match(/^assets\/home\.([a-f0-9]{12})\.css$/u)?.[1];
  if (actualHomeHash !== expectedHomeHash) errors.push(`${homeCssFiles[0]}: filename hash does not match content digest ${expectedHomeHash}`);
}

if (fileSet.has("assets/fortmilo-salesforce-partner-home.png")) {
  errors.push("custom FortMilo/Salesforce Partner composite asset must not be published");
}

for (const image of allFiles.filter((file) => /\.(?:png|jpe?g|ico|svg)$/iu.test(file))) {
  const info = await stat(path.join(root, image));
  if (info.size === 0) errors.push(`${image}: empty image asset`);
}

const contract = await readText("EVIDENCE_TERMINOLOGY_CONTRACT.md");
requireAll(contract, [
  "**Contract version:** 1.0",
  "**Status:** Canonical",
  "This is the **EV-04** condition in the supporting assurance record.",
  "The Salesforce application, validators and technical whitepapers are also conforming artefacts and must be checked before publication or release.",
    "4. The Salesforce implementation and validators are checked for conformity.",
    "5. Technical publications identified as conforming artefacts in section 7 are checked for conformity.",
    "6. The conformity determination for each artefact is recorded before the changed terminology is published or released.",
  "**None found**",
  "**Unavailable**",
  "**Not assessed**",
  "**Not retained at this evidence level**",
  "**Not captured**",
  "**Not applicable**",
  "**Automated**",
  "**Partial Evidence**",
  "**Manual Required**",
  "**Not Covered**",
  "**Extended Check**",
  "**Critical**",
  "**High**",
  "**Moderate**",
  "Scans created before terminology-contract version stamping are **pre-contract / unversioned** evidence.",
  "comparison is **Unavailable**",
  "Existing pre-contract scans are not backfilled",
  "Home",
  "Security Observatory Overview",
  "Findings",
  "Identity & Access",
  "External Connections",
  "Entitlements & Assets",
  "Evidence & Coverage",
  "Architecture & Security",
  "Documents"
], "EVIDENCE_TERMINOLOGY_CONTRACT.md");

const homepage = htmlByRoute.get("index.html") || "";
const homepageMain = mainOf(homepage);
const homepageLead = "Bring OAuth grants, privileged access, external exposure and evidence gaps into one review surface, with reasons and safe next actions kept explicit. Automatic assessment and retained evidence stay inside your Salesforce organisation; user-initiated export is an explicit boundary.";
requireAll(homepage, [
  "<h1>Salesforce security evidence collected and retained inside your org.</h1>",
  `<p class="lead">${homepageLead}</p>`,
  '<li>Read-only</li><li>No automatic remediation</li><li>Evidence retained in your org</li>',
  '<figure class="hero-brand-art"><img src="/assets/fortmilo-brand-banner-1200x675.png" alt="FortMilo" width="1200" height="675"></figure>',
  "Illustrative evidence state",
  "Read-only by design",
  "Unavailable evidence stays explicit",
  "Sanitised evidence by design",
  "Prioritise access and exposure",
  "When a required source cannot be assessed, the state stays Unavailable with a bounded reason and a safe next action. Missing evidence is never converted into zero.",
  "Tokens, session identifiers, secrets, private keys, certificate bodies and credential values are excluded from retained review evidence. Raw IP values are omitted or redacted.",
  '<a class="button button-primary" href="/documents/">Read the technical whitepaper</a>'
], "index.html");

if (count(homepage, 'class="card differentiator-card"') !== 4) errors.push("index.html: expected four differentiator cards");
if (count(homepage, 'class="hero-brand-art"') !== 1) errors.push("index.html: expected one plain FortMilo hero artwork");
if (!/data-page-style="home" href="\/assets\/home\.[a-f0-9]{12}\.css"/u.test(homepage)) errors.push("index.html: missing generated home stylesheet");
prohibitAll(homepageMain, [
  "product-preview",
  "Illustrative product view",
  "fortmilo-salesforce-partner-home.png",
  "FortMilo — Salesforce Partner",
  "Evidence retained inside Salesforce",
  "Read the current technical whitepaper",
  "Selected current zero and unavailable paths have test and controlled runtime evidence",
  "Complete raw-IP retained and export-shape validation remains environment-specific",
  "Evidence retained in your org, with user-initiated export as an explicit boundary."
], "index.html");
requireAll(homeSourceCss, [
  ".home-page .home-differentiator-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }",
  ".home-page .home-differentiator-grid .card { grid-column: auto; }",
  ".home-page .home-differentiator-grid { grid-template-columns: 1fr; }"
], "site-src/home.css");
if (homeSourceCss.includes(".product-preview")) errors.push("site-src/home.css: mock product-preview styling must not return");

for (const [route, html] of htmlByRoute) {
  if (html.includes("exact-candidate")) errors.push(`${route}: internal exact-candidate wording must not be public`);
}

const terminologyConsumers = [
  "index.html",
  "security-observatory/index.html",
  "security-observatory/findings.html",
  "security-observatory/identity-access.html",
  "security-observatory/external-connections.html",
  "security-observatory/entitlements-assets.html",
  "security-observatory/evidence.html",
  "architecture-security.html",
  "documents/index.html"
];
for (const route of terminologyConsumers) {
  const text = htmlByRoute.get(route) || "";
  prohibitAll(text, [
    "No risk evidence surfaced",
    "Formula-injection-safe by default",
    "One export boundary, applied everywhere",
    "Unknown/Error"
  ], route);
}

const findings = htmlByRoute.get("security-observatory/findings.html") || "";
requireAll(findings, [
  "One canonical rendered vocabulary",
  "Contextual metric or finding label",
  "None found",
  "Unavailable",
  "Not assessed",
  "Not retained at this evidence level",
  "Not captured",
  "Not applicable",
  "Partial Evidence",
  "Manual Required",
  "Not Covered",
  "Extended Check",
  "Critical",
  "High",
  "Moderate"
], "security-observatory/findings.html");
prohibitAll(findings, ["Successful zero", "Evidence conditions and current presentation"], "security-observatory/findings.html");

const evidence = htmlByRoute.get("security-observatory/evidence.html") || "";
requireAll(evidence, [
  "One canonical rendered vocabulary",
  "Contextual metric or finding label",
  "None found",
  "Unavailable",
  "Not assessed",
  "Not retained at this evidence level",
  "Not captured",
  "Not applicable",
  "Automated",
  "Partial Evidence",
  "Manual Required",
  "Not Covered",
  "Extended Check",
  "Critical",
  "High",
  "Moderate",
  "Canonical evidence terminology contract v1.0",
  'href="https://github.com/Fortmilo/fortmilo-site/blob/main/EVIDENCE_TERMINOLOGY_CONTRACT.md"',
  "None found is not a pass.",
  "Unavailable is not zero.",
  "Each surface exports a fixed allow-list",
  "Spreadsheet formula-trigger mitigation",
  "This applies to the reviewed export helper paths and the enumerated trigger characters.",
  "It is not a claim that every spreadsheet-injection technique or every export path is covered.",
  "Scans created before terminology-contract version stamping remain pre-contract evidence and are not rewritten.",
  "These figures describe FortMilo’s retained SBS mapping catalogue for mapping set M1 revision 1; they do not assert completeness or equivalence to the current upstream SBS release.",
  "They cannot be compared with v1.0 scans",
  "missing, different or unsupported terminology versions are Unavailable for comparison"
], "security-observatory/evidence.html");
prohibitAll(evidence, [
  "Successful zero",
  "Evidence conditions and current presentation",
  "Safe export",
  "formula-injection-safe"
], "security-observatory/evidence.html");
if (!(evidence.indexOf("What a result does not mean") < evidence.indexOf("Current v1 SBS mapping"))) {
  errors.push("security-observatory/evidence.html: result-boundary section must precede SBS mapping statistics");
}

const architecture = htmlByRoute.get("architecture-security.html") || "";
if (count(architecture, '<p class="section-label">Diagram ') !== 4) errors.push("architecture-security.html: expected four diagrams");
if (count(architecture, '<title id="') !== 4 || count(architecture, '<desc id="') !== 4) errors.push("architecture-security.html: every diagram requires title and description");
requireAll(architecture, [
  "Unavailable evidence remains visible and explained.",
  "The version is recorded inside the PDF.",
  '<h2>Evidence Semantics and Scanner Orchestration</h2>',
  '<a class="button button-primary" href="/documents/">Read the technical whitepaper</a>'
], "architecture-security.html");
if (architecture.includes("Read the current technical whitepaper")) {
  errors.push("architecture-security.html: stale direct/version-defensive whitepaper CTA");
}

const diagram1 = extract(architecture, '<p class="section-label">Diagram 1</p>', '<p class="section-label">Diagram 2</p>', "architecture Diagram 1");
requireAll(diagram1, [
  "SALESFORCE TRUST BOUNDARY",
  "Sanitised CSV",
  "Downloaded",
  "USER-INITIATED DOWNLOAD",
  "Once downloaded, the sanitised file is outside the Salesforce trust boundary."
], "architecture Diagram 1");

const diagram2 = extract(architecture, '<p class="section-label">Diagram 2</p>', '<p class="section-label">Diagram 3</p>', "architecture Diagram 2");
requireAll(diagram2, [
  "AUTHENTICATION ATTEMPTED",
  "REQUIRED READ UNAVAILABLE",
  "Bounded cause + safe next action",
  "Not assessed is not used",
  "Unavailable, not Not assessed"
], "architecture Diagram 2");
prohibitAll(diagram2, ["leaves Tooling evidence not assessed", "Not assessed with a bounded reason"], "architecture Diagram 2");

const diagram3 = extract(architecture, '<p class="section-label">Diagram 3</p>', '<p class="section-label">Diagram 4</p>', "architecture Diagram 3");
requireAll(diagram3, [
  "Prohibited sensitive categories are removed before retained review evidence",
  "Prohibited categories filtered",
  "Tokens · session IDs · secrets · certificate bodies",
  "Raw IP values are omitted or redacted",
  "exact retained-data and export shape remains environment-specific"
], "architecture Diagram 3");
prohibitAll(diagram3, ["Secrets and raw values removed"], "architecture Diagram 3");

const diagram4 = extract(architecture, '<p class="section-label">Diagram 4</p>', '<p class="section-label">Technical whitepaper</p>', "architecture Diagram 4");
requireAll(diagram4, [
  "Was assessment",
  "attempted?",
  "NOT ASSESSED",
  "Not run for this scope",
  "Was usable evidence",
  "obtained?",
  "UNAVAILABLE",
  "Attempted source/read failed",
  "Matching records",
  "observed?",
  "CONTEXTUAL",
  "Metric or finding label",
  "NONE FOUND",
  "Successful assessed zero",
  "Unavailable if attempted · Not assessed if not attempted",
  "None found is reached only after usable evidence was obtained and no matching records were observed."
], "architecture Diagram 4");
prohibitAll(diagram4, [
  "unavailable or incomplete evidence as not assessed",
  "INCOMPLETE EVIDENCE",
  "Did the required read complete?"
], "architecture Diagram 4");

const identity = htmlByRoute.get("security-observatory/identity-access.html") || "";
const identityBoundary = "Session identifiers are never displayed. Raw IP values are omitted or redacted; exact retained-data shape is validated per environment.";
if (count(identity, identityBoundary) !== 2) errors.push("identity-access.html: expected customer-facing identity boundary twice");
if (identity.includes("complete retained-data and export-shape validation remains environment-specific")) errors.push("identity-access.html: evidence-register wording returned");

const documents = htmlByRoute.get("documents/index.html") || "";
requireAll(documents, [
  "Technical whitepaper",
  "Evidence Semantics and Scanner Orchestration",
  'href="/documents/evidence-semantics-and-scanner-orchestration.pdf"',
  "The evidence semantics and scanner architecture behind Security Observatory. Read this to evaluate the product.",
  "Methodology paper",
  "Orchestrating AI for Secure Software Delivery",
  "Written for engineering and governance readers; it is not product documentation.",
  'href="/documents/orchestrating-ai-for-secure-software-delivery.pdf"'
], "documents/index.html");
if (count(documents, 'class="card technical-resource"') !== 2) errors.push("documents/index.html: expected two resource cards");
prohibitAll(documents, [
  "Publication status:",
  "Previous versions",
  "Older versioned PDFs"
], "documents/index.html");
if (/href="\/documents\/[^"]*-v\d+(?:\.\d+)*\.pdf"/iu.test(documents)) errors.push("documents/index.html: versioned public PDF href must not be published");
const documentHeadings = [...documents.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/giu)]
  .map((match) => match[2].replace(/<[^>]+>/gu, " "));
if (documentHeadings.some((heading) => /\bv\d+(?:\.\d+)*\b/iu.test(heading))) {
  errors.push("documents/index.html: document heading must not expose a version number");
}

const privacy = htmlByRoute.get("privacy.html") || "";
requireAll(privacy, [
  "Last updated:</strong> 10 August 2026",
  "12 months after the enquiry closes",
  "IP address",
  "Where FortMilo makes a restricted transfer",
  "UK adequacy regulations or appropriate safeguards",
  "Information about the applicable safeguards is available on request."
], "privacy.html");

const terms = htmlByRoute.get("terms.html") || "";
requireAll(terms, [
  "Any Security Observatory source material published by FortMilo is licensed as stated with that material",
  "Apache License 2.0",
  "Source publication does not by itself represent package availability, release validation or installation readiness.",
  "law of England and Wales",
  "courts of England and Wales have exclusive jurisdiction"
], "terms.html");

const robots = await readText("robots.txt");
const expectedRobots = "User-agent: *\nAllow: /\nSitemap: https://fortmilo.co.uk/sitemap.xml\n";
if (robots !== expectedRobots) errors.push("robots.txt: unexpected content");

const sitemap = await readText("sitemap.xml");
const indexableRoutes = routes.filter((route) => !route.noindex);
if (count(sitemap, "<url>") !== indexableRoutes.length) errors.push("sitemap.xml: route count mismatch");
for (const route of indexableRoutes) {
  if (!sitemap.includes(`<loc>${route.canonical}</loc><lastmod>${route.lastmod}</lastmod>`)) errors.push(`sitemap.xml: missing ${route.canonical} / ${route.lastmod}`);
}
if (/\.pdf<\/loc>|404\.html<\/loc>/u.test(sitemap)) errors.push("sitemap.xml: PDF or 404 must not be indexed");

const allowedDocumentFiles = [
  "documents/evidence-semantics-and-scanner-orchestration.pdf",
  "documents/index.html",
  "documents/orchestrating-ai-for-secure-software-delivery.pdf"
];
const publicDocumentFiles = allFiles.filter((file) => file.startsWith("documents/")).sort();
if (JSON.stringify(publicDocumentFiles) !== JSON.stringify(allowedDocumentFiles)) {
  errors.push(`documents/: public artefact allow-list mismatch: ${publicDocumentFiles.join(", ")}`);
}
for (const file of publicDocumentFiles) {
  if (/^documents\/.*-v\d+(?:\.\d+)*\.pdf$/iu.test(file)) errors.push(`versioned public PDF must not be published: ${file}`);
}

for (const pdf of [
  "documents/evidence-semantics-and-scanner-orchestration.pdf",
  "documents/orchestrating-ai-for-secure-software-delivery.pdf"
]) {
  if (!fileSet.has(pdf)) errors.push(`missing ${pdf}`);
  else if ((await stat(path.join(root, pdf))).size < 10_000) errors.push(`${pdf}: unexpectedly small`);
}

const securityText = await readText(".well-known/security.txt");
requireAll(securityText, [
  "Contact: mailto:info@fortmilo.co.uk",
  "Preferred-Languages: en",
  "Canonical: https://fortmilo.co.uk/.well-known/security.txt"
], "security.txt");

const textFiles = allFiles.filter((file) => /\.(?:html|css|mjs|json|txt|md|xml)$/iu.test(file) && file !== "scripts/validate-site.mjs");
for (const relative of textFiles) {
  const text = await readText(relative);
  for (const prohibited of [
    "fortmilo-salesforce-partner-home.png",
    "Formula-injection-safe by default",
    "One export boundary, applied everywhere"
  ]) if (text.includes(prohibited)) errors.push(`${relative}: prohibited stale token ${prohibited}`);
  if (/\b(?:access_token|refresh_token|client_secret|consumer_secret|session_id)\s*[:=]\s*[A-Za-z0-9._-]{12,}/iu.test(text)) {
    errors.push(`${relative}: potential secret-like value`);
  }
}

if (errors.length) {
  console.error(`Validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const cssDigest = cssFiles.length === 1
  ? createHash("sha256").update(await readFile(path.join(root, cssFiles[0]))).digest("hex").slice(0, 12)
  : "missing";
const homeCssDigest = homeCssFiles.length === 1
  ? createHash("sha256").update(await readFile(path.join(root, homeCssFiles[0]))).digest("hex").slice(0, 12)
  : "missing";
console.log(`Validated ${routes.length} routes, ${allFiles.length} files, Evidence Terminology Contract v1.0 and CSS ${cssDigest}/${homeCssDigest} with no errors.`);
