import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const mode = process.argv[2];
const buildDirectory = process.argv[3] || "_site";
const errors = [];

const sourcePages = [
  { file: "index.html", layout: "default" },
  { file: "security-observatory/index.html", layout: "default" },
  { file: "security-observatory/findings.html", layout: "default" },
  { file: "security-observatory/evidence.html", layout: "default" },
  { file: "security-observatory/admin.html", layout: "default" },
  { file: "security-observatory/architecture.html", layout: "default" },
  { file: "privacy.html", layout: "default" },
  { file: "terms.html", layout: "default" },
  { file: "404.html", layout: "default" },
  { file: "robots.txt", layout: "null" }
];

const builtHtmlPages = [
  "index.html",
  "security-observatory/index.html",
  "security-observatory/findings.html",
  "security-observatory/evidence.html",
  "security-observatory/admin.html",
  "security-observatory/architecture.html",
  "privacy.html",
  "terms.html",
  "404.html"
];

const sitemapUrls = [
  "https://fortmilo.co.uk/",
  "https://fortmilo.co.uk/security-observatory/",
  "https://fortmilo.co.uk/security-observatory/findings.html",
  "https://fortmilo.co.uk/security-observatory/evidence.html",
  "https://fortmilo.co.uk/security-observatory/admin.html",
  "https://fortmilo.co.uk/security-observatory/architecture.html",
  "https://fortmilo.co.uk/privacy.html",
  "https://fortmilo.co.uk/terms.html"
];

function report(message) {
  errors.push(message);
}

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function read(relativePath) {
  const filePath = absolute(relativePath);
  if (!fs.existsSync(filePath)) {
    report(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

function parseFrontMatter(relativePath, text) {
  if (!text.startsWith("---\n")) {
    report(`${relativePath} must begin with YAML front matter.`);
    return {};
  }

  const end = text.indexOf("\n---\n", 4);
  if (end === -1) {
    report(`${relativePath} has unterminated YAML front matter.`);
    return {};
  }

  const frontMatter = text.slice(4, end);
  const result = {};
  for (const line of frontMatter.split("\n")) {
    if (!line.trim()) continue;
    if (/^\s/.test(line)) {
      report(`${relativePath} contains an indented top-level front-matter key: ${line}`);
      continue;
    }
    const separator = line.indexOf(":");
    if (separator < 1) {
      report(`${relativePath} contains invalid front matter: ${line}`);
      continue;
    }
    result[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return result;
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function relativeLuminance(hex) {
  const channels = hex
    .replace("#", "")
    .match(/.{2}/g)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(firstHex, secondHex) {
  const first = relativeLuminance(firstHex);
  const second = relativeLuminance(secondHex);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function checkSource() {
  if (fs.existsSync(absolute(".nojekyll"))) {
    report(".nojekyll must not exist because the shared Jekyll layout is required.");
  }
  if (fs.existsSync(absolute("styles.css"))) {
    report("Root styles.css must be removed; assets/styles.css is the only site stylesheet.");
  }

  const requiredSharedFiles = [
    "_config.yml",
    "_layouts/default.html",
    "_includes/header.html",
    "_includes/footer.html",
    "assets/styles.css",
    "assets/fortmilo-logo.svg"
  ];
  requiredSharedFiles.forEach((file) => read(file));

  const pageTexts = new Map();
  for (const page of sourcePages) {
    const text = read(page.file);
    pageTexts.set(page.file, text);
    if (!text) continue;
    const frontMatter = parseFrontMatter(page.file, text);
    if (frontMatter.layout !== page.layout) {
      report(`${page.file} must declare layout: ${page.layout}.`);
    }
    if (page.file.endsWith(".html")) {
      for (const key of ["title", "description", "permalink", "nav_key"]) {
        if (!frontMatter[key]) report(`${page.file} is missing front-matter key: ${key}.`);
      }
    }
  }

  const layout = read("_layouts/default.html");
  if (!layout.includes("{% include header.html %}") || !layout.includes("{% include footer.html %}")) {
    report("The default layout must use the canonical shared header and footer includes.");
  }
  if (countOccurrences(layout, 'rel="stylesheet"') !== 1 || !layout.includes("/assets/styles.css")) {
    report("The default layout must reference exactly one stylesheet: assets/styles.css.");
  }
  if (!layout.includes("page.url | absolute_url")) {
    report("The default layout must derive canonical and Open Graph URLs from page.url.");
  }

  const contentFiles = [
    ...sourcePages.map((page) => page.file),
    "_layouts/default.html",
    "_includes/header.html",
    "_includes/footer.html"
  ];
  const combinedContent = contentFiles.map((file) => read(file)).join("\n");
  const forbiddenPatterns = [
    [/SecuredForce/gi, "legacy SecuredForce branding"],
    [/[A-Z0-9._%+-]+@gmail\.com/gi, "public Gmail address"],
    [/20\+ automated checks/gi, "unverified automated-check count"],
    [/free forever/gi, "unsupported free-forever claim"],
    [/request install/gi, "unsupported install request call-to-action"],
    [/Salesforce Security Benchmark/g, "incorrect SBS name"],
    [/Not retained at this evidence level/gi, "incorrect evidence-state label"]
  ];
  for (const [pattern, description] of forbiddenPatterns) {
    if (pattern.test(combinedContent)) report(`Forbidden public wording found: ${description}.`);
  }

  const evidencePage = pageTexts.get("security-observatory/evidence.html") || "";
  const requiredBoundary = "The Observatory references Security Benchmark for Salesforce control identifiers to organise supporting evidence. It does not determine SBS compliance and produces no SBS pass/fail result.";
  if (!evidencePage.includes(requiredBoundary)) {
    report("The SBS page is missing the canonical no-compliance/no-pass-fail boundary statement.");
  }
  for (const label of ["Evidence returned", "Zero observed", "Scanner issue", "Not assessed"]) {
    if (!evidencePage.includes(`>${label}<`)) report(`The SBS page is missing scanner-family status: ${label}.`);
  }
  for (const label of ["Automated", "Partial Evidence", "Manual Required", "Not Covered", "Extended Check"]) {
    if (!evidencePage.includes(`>${label}<`)) report(`The SBS page is missing coverage state: ${label}.`);
  }
  for (const fabricatedCount of [/12 families/i, /4 families/i, /1 family/i, /2 families/i]) {
    if (fabricatedCount.test(evidencePage)) report(`The SBS page contains a fabricated illustrative count: ${fabricatedCount}.`);
  }

  const findingsPage = pageTexts.get("security-observatory/findings.html") || "";
  for (const label of [
    "None found",
    "Not assessed",
    "Not assessed at this evidence level",
    "Not captured",
    "Unavailable",
    "Not applicable"
  ]) {
    if (!findingsPage.includes(`>${label}<`)) report(`The Findings page is missing evidence state: ${label}.`);
  }
  if (!findingsPage.includes(">Implemented<") || !findingsPage.includes(">Not implemented<")) {
    report("The Findings page must use the binary Implemented / Not implemented public capability states.");
  }

  const scheduleQualification = "Admin-managed scheduled scans are implemented in the current package source. Support through the public installation path remains subject to clean-org installation proof.";
  if (countOccurrences(combinedContent, scheduleQualification) !== 1) {
    report("The scheduled-scan public-install qualification must appear exactly once across public content.");
  }
  if (!(pageTexts.get("security-observatory/admin.html") || "").includes(scheduleQualification)) {
    report("The scheduled-scan public-install qualification must live on the Admin page.");
  }

  const footer = read("_includes/footer.html");
  const terms = pageTexts.get("terms.html") || "";
  const copyrightSentence = "Site content © 2026 Luca Pacini trading as FortMilo Lab. All rights reserved.";
  const licenceSentence = "Source code deliberately published in the Salesforce Security Observatory repository is licensed under the Apache License 2.0 unless an individual file states otherwise.";
  for (const sentence of [copyrightSentence, licenceSentence]) {
    if (!footer.includes(sentence)) report(`The shared footer is missing: ${sentence}`);
    if (!terms.includes(sentence)) report(`The Terms page is missing: ${sentence}`);
  }

  const privacy = pageTexts.get("privacy.html") || "";
  for (const requiredPhrase of [
    "24 months after the last substantive contact",
    "Information Commissioner's Office",
    "GitHub Pages",
    "International transfers",
    "legitimate interests"
  ]) {
    if (!privacy.includes(requiredPhrase)) report(`The Privacy page is missing required content: ${requiredPhrase}.`);
  }

  const robots = pageTexts.get("robots.txt") || "";
  if (!robots.includes("Sitemap: https://fortmilo.co.uk/sitemap.xml")) {
    report("robots.txt must include the absolute Sitemap URL.");
  }

  const css = read("assets/styles.css");
  for (const requiredCss of [":focus-visible", "scroll-margin-top", "prefers-reduced-motion"]) {
    if (!css.includes(requiredCss)) report(`Accessibility CSS requirement missing: ${requiredCss}.`);
  }
  const accentMatch = css.match(/--accent:\s*(#[0-9a-fA-F]{6})/);
  if (!accentMatch) {
    report("Unable to find the primary accent colour for contrast validation.");
  } else {
    const ratio = contrastRatio(accentMatch[1], "#ffffff");
    if (ratio < 4.5) report(`Primary button contrast is ${ratio.toFixed(2)}:1; WCAG AA requires at least 4.5:1.`);
  }
}

function builtPathForUrl(rawUrl, currentHtmlFile, siteRoot) {
  const withoutFragment = rawUrl.split("#", 1)[0].split("?", 1)[0];
  if (!withoutFragment) return null;
  if (/^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(withoutFragment)) return null;

  const currentUrlDirectory = path.posix.dirname(`/${currentHtmlFile.replace(/\\/g, "/")}`);
  let resolvedUrl = withoutFragment.startsWith("/")
    ? path.posix.normalize(withoutFragment)
    : path.posix.normalize(path.posix.join(currentUrlDirectory, withoutFragment));

  if (resolvedUrl === "/") resolvedUrl = "/index.html";
  else if (resolvedUrl.endsWith("/")) resolvedUrl += "index.html";

  return path.join(siteRoot, resolvedUrl.replace(/^\//, ""));
}

function checkBuilt() {
  const siteRoot = absolute(buildDirectory);
  if (!fs.existsSync(siteRoot)) {
    report(`Built site directory does not exist: ${buildDirectory}`);
    return;
  }

  const requiredBuiltFiles = [
    ...builtHtmlPages,
    "robots.txt",
    "sitemap.xml",
    "assets/styles.css",
    "assets/fortmilo-logo.svg"
  ];
  for (const file of requiredBuiltFiles) {
    if (!fs.existsSync(path.join(siteRoot, file))) report(`Built site is missing: ${file}`);
  }
  if (fs.existsSync(path.join(siteRoot, "styles.css"))) {
    report("Built site contains a second root stylesheet.");
  }
  if (fs.existsSync(path.join(siteRoot, "README.html"))) {
    report("README.md was rendered into the public site; verify _config.yml exclusions.");
  }

  for (const htmlFile of builtHtmlPages) {
    const filePath = path.join(siteRoot, htmlFile);
    if (!fs.existsSync(filePath)) continue;
    const html = fs.readFileSync(filePath, "utf8");

    if (/\{[{%]/.test(html)) report(`${htmlFile} contains unrendered Liquid syntax.`);
    if ((html.match(/<h1\b/gi) || []).length !== 1) report(`${htmlFile} must contain exactly one h1.`);
    if (!html.includes('class="skip-link"')) report(`${htmlFile} is missing the skip link.`);
    if (!/<link\s+rel="canonical"\s+href="https:\/\/fortmilo\.co\.uk\//i.test(html)) report(`${htmlFile} is missing an absolute canonical URL.`);
    for (const property of ["og:site_name", "og:title", "og:description", "og:url"]) {
      if (!html.includes(`property="${property}"`)) report(`${htmlFile} is missing ${property}.`);
    }
    if ((html.match(/rel="stylesheet"/g) || []).length !== 1 || !html.includes("/assets/styles.css")) {
      report(`${htmlFile} must reference exactly one shared stylesheet.`);
    }

    const references = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
    for (const reference of references) {
      const targetPath = builtPathForUrl(reference, htmlFile, siteRoot);
      if (targetPath && !fs.existsSync(targetPath)) {
        report(`${htmlFile} contains a dead internal reference: ${reference}`);
      }
    }
  }

  const robotsPath = path.join(siteRoot, "robots.txt");
  if (fs.existsSync(robotsPath)) {
    const robots = fs.readFileSync(robotsPath, "utf8");
    if (!robots.includes("Sitemap: https://fortmilo.co.uk/sitemap.xml")) report("Built robots.txt is missing its Sitemap declaration.");
    if (robots.includes("---")) report("Built robots.txt still contains front matter.");
  }

  const sitemapPath = path.join(siteRoot, "sitemap.xml");
  if (fs.existsSync(sitemapPath)) {
    const sitemap = fs.readFileSync(sitemapPath, "utf8");
    for (const url of sitemapUrls) {
      if (!sitemap.includes(url)) report(`Generated sitemap is missing ${url}.`);
    }
  }

  const cssFiles = walk(siteRoot).filter((file) => file.endsWith(".css"));
  if (cssFiles.length !== 1 || path.relative(siteRoot, cssFiles[0]).replace(/\\/g, "/") !== "assets/styles.css") {
    report(`Built site must contain exactly one CSS file; found: ${cssFiles.map((file) => path.relative(siteRoot, file)).join(", ")}`);
  }
}

if (mode === "source") checkSource();
else if (mode === "built") checkBuilt();
else report("Usage: node scripts/check-site.mjs <source|built> [built-directory]");

if (errors.length) {
  console.error("FortMilo site validation failed:\n");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`FortMilo site ${mode} validation passed.`);
