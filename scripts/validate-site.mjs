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

function bodyOf(html) {
  return /<body\b[\s\S]*?<\/body>/u.exec(html)?.[0] || "";
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

const allFiles = await walk(root);
const fileSet = new Set(allFiles);
const htmlByRoute = new Map();

for (const route of routes) {
  const html = await readText(route.output);
  htmlByRoute.set(route.output, html);
  if (!html) continue;

  if (!html.startsWith("<!doctype html>")) errors.push(`${route.output}: missing HTML5 doctype`);
  if (!html.includes('<html lang="en-GB">')) errors.push(`${route.output}: missing en-GB language`);
  for (const required of [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<a class="skip-link" href="#main">Skip to content</a>',
    '<link rel="manifest" href="/site.webmanifest">'
  ]) if (!html.includes(required)) errors.push(`${route.output}: missing ${required}`);

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
  for (const required of [
    'href="/contact.html">Contact</a>',
    'href="/privacy.html">Privacy</a>',
    'href="/terms.html">Terms</a>',
    'href="/documents/">Technical whitepaper</a>',
    'href="/acknowledgements.html">Acknowledgements</a>',
    'href="/.well-known/security.txt">Security</a>',
    "FortMilo is a Salesforce Partner.",
    "Security Observatory is independently developed and is not endorsed by Salesforce, Inc.",
    "Salesforce is a trademark of Salesforce, Inc."
  ]) if (!footer.includes(required)) errors.push(`${route.output}: footer missing ${required}`);

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
}
const homeCssFiles = allFiles.filter((file) => /^assets\/home\.[a-f0-9]{12}\.css$/u.test(file));
if (homeCssFiles.length !== 1) errors.push(`expected one generated home CSS file, found ${homeCssFiles.length}`);
const homeSourceCss = await readText("site-src/home.css");
if (homeCssFiles.length === 1) {
  const generatedHomeCss = await readText(homeCssFiles[0]);
  if (generatedHomeCss !== homeSourceCss) errors.push(`${homeCssFiles[0]} does not match site-src/home.css`);
}

if (fileSet.has("assets/fortmilo-salesforce-partner-home.png")) {
  errors.push("custom FortMilo/Salesforce Partner composite asset must not be published");
}

for (const image of allFiles.filter((file) => /\.(?:png|jpe?g|ico|svg)$/iu.test(file))) {
  const info = await stat(path.join(root, image));
  if (info.size === 0) errors.push(`${image}: empty image asset`);
}

const homepage = htmlByRoute.get("index.html") || "";
const homepageMain = mainOf(homepage);
const homepageLead = "Bring OAuth grants, privileged access, external exposure and evidence gaps into one review surface, with reasons and safe next actions kept explicit. Automatic assessment and retained evidence stay inside your Salesforce organisation; user-initiated export is an explicit boundary.";
for (const required of [
  "<h1>Salesforce security evidence collected and retained inside your org.</h1>",
  `<p class="lead">${homepageLead}</p>`,
  '<li>Read-only</li><li>No automatic remediation</li><li>Evidence retained in your org</li>',
  'class="product-preview"',
  "Illustrative product view — no organisation data or evidence values shown.",
  "OAuth grants requiring review",
  "Privileged access evidence",
  "Required source unavailable",
  "When a required source cannot be assessed, the state stays Unavailable with a bounded reason and a safe next action. Missing evidence is never converted into zero.",
  "Tokens, session identifiers, secrets, private keys, certificate bodies and credential values are excluded from retained review evidence. Raw IP values are omitted or redacted.",
  '<a class="button button-primary" href="/documents/">Read the technical whitepaper</a>'
]) if (!homepage.includes(required)) errors.push(`index.html: missing current homepage contract ${required}`);

if (count(homepage, 'class="card differentiator-card"') !== 5) errors.push("index.html: expected five differentiator cards");
if (count(homepage, 'class="product-preview"') !== 1) errors.push("index.html: expected one product preview");
for (const prohibited of [
  "fortmilo-salesforce-partner-home.png",
  "FortMilo — Salesforce Partner",
  "Read the current technical whitepaper",
  "Selected current zero and unavailable paths have test and controlled runtime evidence",
  "Complete raw-IP retained and export-shape validation remains environment-specific",
  "Evidence retained in your org, with user-initiated export as an explicit boundary."
]) if (homepageMain.includes(prohibited)) errors.push(`index.html: prohibited homepage wording/asset ${prohibited}`);

if (!/data-page-style="home" href="\/assets\/home\.[a-f0-9]{12}\.css"/u.test(homepage)) errors.push("index.html: missing generated home stylesheet");
for (const cssRequired of [
  ".home-page .card-grid-five { grid-template-columns: repeat(2, minmax(0, 1fr)); }",
  ".home-page .card-grid-five .card:last-child { grid-column: 1 / -1; }",
  ".product-preview-window",
  ".product-preview-body"
]) if (!homeSourceCss.includes(cssRequired)) errors.push(`site-src/home.css: missing ${cssRequired}`);

const evidence = htmlByRoute.get("security-observatory/evidence.html") || "";
for (const prohibited of [
  "Formula-injection-safe by default",
  "formula-injection-safe",
  "Safe export",
  "One export boundary, applied everywhere",
  "One canonical rendered vocabulary",
  "None found",
  "Unknown/Error"
]) if (evidence.toLowerCase().includes(prohibited.toLowerCase())) errors.push(`security-observatory/evidence.html: prohibited ${prohibited}`);
for (const required of [
  "Evidence conditions and current presentation",
  "Observed evidence",
  "Successful zero",
  "Unavailable source",
  "Retained-read warning",
  "No risk evidence surfaced or numeric 0",
  "Needs review / fixed warning copy",
  "Detail not retained",
  "Presentation may vary by surface, but it must not strengthen the underlying evidence.",
  "No risk evidence surfaced or a zero count is not a pass.",
  "Each surface exports a fixed allow-list",
  "Spreadsheet formula-trigger mitigation",
  "This applies to the reviewed export helper paths and the enumerated trigger characters.",
  "It is not a claim that every spreadsheet-injection technique or every export path is covered."
]) if (!evidence.includes(required)) errors.push(`security-observatory/evidence.html: missing ${required}`);
if (!(evidence.indexOf("What a result does not mean") < evidence.indexOf("Current v1 SBS mapping"))) {
  errors.push("security-observatory/evidence.html: result-boundary section must precede SBS mapping statistics");
}

const architecture = htmlByRoute.get("architecture-security.html") || "";
if (count(architecture, '<p class="section-label">Diagram ') !== 4) errors.push("architecture-security.html: expected four diagrams");
if (count(architecture, '<title id="') !== 4 || count(architecture, '<desc id="') !== 4) errors.push("architecture-security.html: every diagram requires title and description");
const diagram2 = extract(architecture, '<p class="section-label">Diagram 2</p>', '<p class="section-label">Diagram 3</p>', "architecture Diagram 2");
for (const required of [
  "AUTHENTICATION ATTEMPTED",
  "REQUIRED READ UNAVAILABLE",
  "Bounded cause + safe next action",
  "Not assessed is not used",
  "Unavailable, not Not assessed"
]) if (!diagram2.includes(required)) errors.push(`architecture Diagram 2: missing ${required}`);
for (const prohibited of ["leaves Tooling evidence not assessed", "Not assessed with a bounded reason"]) if (diagram2.includes(prohibited)) errors.push(`architecture Diagram 2: prohibited ${prohibited}`);

const diagram4 = extract(architecture, '<p class="section-label">Diagram 4</p>', '<p class="section-label">Technical whitepaper</p>', "architecture Diagram 4");
for (const required of [
  "Was assessment",
  "attempted?",
  "NOT ASSESSED",
  "Not selected or not run",
  "Did the required",
  "read complete?",
  "UNAVAILABLE",
  "Attempted read failed",
  "SUCCESSFUL ZERO",
  "Unavailable if attempted · Not assessed if not attempted",
  "An attempted read failure is Unavailable, never Not assessed or a successful zero."
]) if (!diagram4.includes(required)) errors.push(`architecture Diagram 4: missing ${required}`);
for (const prohibited of ["unavailable or incomplete evidence as not assessed", "UNAVAILABLE OR", "INCOMPLETE EVIDENCE", "NONE FOUND"]) if (diagram4.includes(prohibited)) errors.push(`architecture Diagram 4: prohibited ${prohibited}`);
for (const required of [
  '<h2>Evidence Semantics and Scanner Orchestration</h2>',
  '<a class="button button-primary" href="/documents/">Read the technical whitepaper</a>'
]) if (!architecture.includes(required)) errors.push(`architecture-security.html: missing ${required}`);
if (/evidence-semantics-and-scanner-orchestration-v1\.4\.pdf/u.test(architecture) || architecture.includes("Read the current technical whitepaper")) {
  errors.push("architecture-security.html: stale direct/version-defensive whitepaper CTA");
}

const identity = htmlByRoute.get("security-observatory/identity-access.html") || "";
const identityBoundary = "Session identifiers are never displayed. Raw IP values are omitted or redacted; exact retained-data shape is validated per environment.";
if (count(identity, identityBoundary) !== 2) errors.push("identity-access.html: expected customer-facing identity boundary twice");
if (identity.includes("complete retained-data and export-shape validation remains environment-specific")) errors.push("identity-access.html: evidence-register wording returned");

const documents = htmlByRoute.get("documents/index.html") || "";
for (const required of [
  "Technical whitepaper",
  "Evidence Semantics and Scanner Orchestration v1.4",
  'href="/documents/evidence-semantics-and-scanner-orchestration-v1.4.pdf"',
  "The evidence semantics and scanner architecture behind Security Observatory. Read this to evaluate the product.",
  "Methodology paper",
  "Orchestrating AI for Secure Software Delivery v1.0",
  "Written for engineering and governance readers; it is not product documentation.",
  'href="/documents/orchestrating-ai-for-secure-software-delivery-v1.0.pdf"'
]) if (!documents.includes(required)) errors.push(`documents/index.html: missing ${required}`);
if (count(documents, 'class="card technical-resource"') !== 2) errors.push("documents/index.html: expected two resource cards");

const privacy = htmlByRoute.get("privacy.html") || "";
for (const required of [
  "Last updated:</strong> 10 August 2026",
  "12 months after the enquiry closes",
  "IP address",
  "Where FortMilo makes a restricted transfer",
  "UK adequacy regulations or appropriate safeguards",
  "Information about the applicable safeguards is available on request."
]) if (!privacy.includes(required)) errors.push(`privacy.html: missing ${required}`);

const terms = htmlByRoute.get("terms.html") || "";
for (const required of [
  "Any Security Observatory source material published by FortMilo is licensed as stated with that material",
  "Apache License 2.0",
  "Source publication does not by itself represent package availability, release validation or installation readiness.",
  "law of England and Wales",
  "courts of England and Wales have exclusive jurisdiction"
]) if (!terms.includes(required)) errors.push(`terms.html: missing ${required}`);

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

for (const pdf of [
  "documents/evidence-semantics-and-scanner-orchestration-v1.4.pdf",
  "documents/orchestrating-ai-for-secure-software-delivery-v1.0.pdf"
]) {
  if (!fileSet.has(pdf)) errors.push(`missing ${pdf}`);
  else if ((await stat(path.join(root, pdf))).size < 10_000) errors.push(`${pdf}: unexpectedly small`);
}

const securityText = await readText(".well-known/security.txt");
for (const required of [
  "Contact: mailto:info@fortmilo.co.uk",
  "Preferred-Languages: en",
  "Canonical: https://fortmilo.co.uk/.well-known/security.txt"
]) if (!securityText.includes(required)) errors.push(`security.txt: missing ${required}`);

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
console.log(`Validated ${routes.length} routes, ${allFiles.length} files and CSS ${cssDigest}/${homeCssDigest} with no errors.`);
