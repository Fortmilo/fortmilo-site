import { readdir, readFile, stat } from "node:fs/promises";
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

function visibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/<script\b[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[\s\S]*?<\/style>/giu, " ")
    .replace(/\b(?:href|src)="[^"]*"/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ");
}

function resolvePublicPath(value) {
  const clean = value.split("#", 1)[0].split("?", 1)[0];
  if (!clean || clean === "/") return "index.html";
  const relative = clean.startsWith("/") ? clean.slice(1) : clean;
  return relative.endsWith("/") ? `${relative}index.html` : relative;
}

const allFiles = await walk(root);
const fileSet = new Set(allFiles);
const prohibitedNames = [
  "FortMilo Security Observatory",
  "Fortmilo Security Observatory",
  "FORTMILO Security Observatory",
  "Salesforce Security Observatory",
  "Security Observatory by FortMilo"
];

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

  const headingLevels = [...html.matchAll(/<h([1-6])\b[^>]*>/giu)].map((match) => Number(match[1]));
  const h1Count = headingLevels.filter((level) => level === 1).length;
  if (h1Count !== 1) errors.push(`${route.output}: expected exactly one H1, found ${h1Count}`);
  if (headingLevels.length && headingLevels[0] !== 1) errors.push(`${route.output}: H1 must be first heading`);
  for (let index = 1; index < headingLevels.length; index += 1) {
    if (headingLevels[index] > headingLevels[index - 1] + 1) {
      errors.push(`${route.output}: skipped H${headingLevels[index - 1]} to H${headingLevels[index]}`);
    }
  }

  const customerText = visibleText(html);
  for (const name of prohibitedNames) {
    if (customerText.includes(name)) errors.push(`${route.output}: prohibited customer-visible name ${name}`);
  }

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
if (indexed.some((route) => route.lastmod !== "2026-08-19")) {
  errors.push("site-map: every indexed route must have lastmod 2026-08-19");
}

const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
if ((sitemap.match(/<lastmod>2026-08-19<\/lastmod>/gu) || []).length !== indexed.length) {
  errors.push(`sitemap: expected ${indexed.length} lastmod values for 2026-08-19`);
}

const home = await readFile(path.join(root, "index.html"), "utf8");
if (!home.includes("Request access when available")) errors.push("index.html: missing access request CTA");
const overview = await readFile(path.join(root, "security-observatory/index.html"), "utf8");
for (const value of ["<h1>Security Observatory</h1>", "Five review areas", "Request access when available"]) {
  if (!overview.includes(value)) errors.push(`security-observatory/index.html: missing ${value}`);
}
const architecture = await readFile(path.join(root, "architecture-security.html"), "utf8");
if (!architecture.includes("<strong>Read-only assessment</strong><span>No security remediation or write-back to assessed Salesforce configuration.</span>")) {
  errors.push("architecture-security.html: incorrect read-only assessment boundary");
}
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
if (referenceSvg.includes("Security Observatory by FortMilo")) {
  errors.push("reference architecture: routine compound title remains");
}

for (const image of allFiles.filter((file) => /\.(?:png|jpe?g|ico|svg)$/iu.test(file))) {
  if ((await stat(path.join(root, image))).size === 0) errors.push(`${image}: empty image asset`);
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`Validated ${routes.length} routes, ${indexed.length} indexed lastmod values, shared footer, headings, naming, links and reference architecture`);
