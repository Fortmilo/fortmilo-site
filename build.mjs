import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CHECK = process.argv.includes("--check");
const TODAY = "2026-07-30";

const pages = [
  { path: "index.html", canonical: "/", corporate: "home", bodyClass: "home-page", ogType: "website" },
  { path: "security-observatory/index.html", canonical: "/security-observatory/", corporate: "product", product: "overview", bodyClass: "product-page", ogType: "website" },
  { path: "security-observatory/findings.html", canonical: "/security-observatory/findings.html", corporate: "product", product: "findings", bodyClass: "product-page", ogType: "article" },
  { path: "security-observatory/identity-access.html", canonical: "/security-observatory/identity-access.html", corporate: "product", product: "identity", bodyClass: "product-page", ogType: "article" },
  { path: "security-observatory/external-connections.html", canonical: "/security-observatory/external-connections.html", corporate: "product", product: "external", bodyClass: "product-page", ogType: "article" },
  { path: "security-observatory/entitlements-assets.html", canonical: "/security-observatory/entitlements-assets.html", corporate: "product", product: "entitlements", bodyClass: "product-page", ogType: "article" },
  { path: "security-observatory/evidence.html", canonical: "/security-observatory/evidence.html", corporate: "product", product: "evidence", bodyClass: "product-page", ogType: "article" },
  { path: "architecture-security.html", canonical: "/architecture-security.html", corporate: "architecture", bodyClass: "architecture-page", ogType: "article" },
  { path: "contact.html", canonical: "/contact.html", corporate: "contact", bodyClass: "contact-page", ogType: "website" },
  { path: "privacy.html", canonical: "/privacy.html", bodyClass: "legal-page", ogType: "article" },
  { path: "terms.html", canonical: "/terms.html", bodyClass: "legal-page", ogType: "article" },
  { path: "404.html", canonical: "/404.html", bodyClass: "not-found-page", ogType: "website", sitemap: false }
];

const corporateLinks = [
  ["home", "/", "Home"],
  ["product", "/security-observatory/", "Security Observatory"],
  ["architecture", "/architecture-security.html", "Architecture & Security"],
  ["contact", "/contact.html", "Contact"]
];

const productLinks = [
  ["overview", "/security-observatory/", "Overview"],
  ["findings", "/security-observatory/findings.html", "Findings"],
  ["identity", "/security-observatory/identity-access.html", "Identity & Access"],
  ["external", "/security-observatory/external-connections.html", "External Connections"],
  ["entitlements", "/security-observatory/entitlements-assets.html", "Entitlements & Assets"],
  ["evidence", "/security-observatory/evidence.html", "Evidence & Coverage"]
];

const escapeHtml = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const attr = (active, key) => active === key ? ' aria-current="page"' : "";

const corporateNav = (active) => corporateLinks
  .map(([key, href, label]) => `<a${attr(active, key)} href="${href}">${escapeHtml(label)}</a>`)
  .join("");

const productNav = (active) => active
  ? `<div class="product-nav-wrap"><nav class="product-nav container" aria-label="Security Observatory sections">${productLinks.map(([key, href, label]) => `<a${attr(active, key)} href="${href}">${escapeHtml(label)}</a>`).join("")}</nav></div>`
  : "";

const footer = `  <footer class="site-footer">
    <div class="container footer-grid">
      <div>
        <p><strong>FortMilo</strong> is the public brand of Luca Pacini trading as FortMilo Lab.</p>
        <p>Independent organisation. Not affiliated with, endorsed by or sponsored by Salesforce, Inc.</p>
        <p>Salesforce is a trademark of Salesforce, Inc.</p>
      </div>
      <nav class="footer-links" aria-label="Footer navigation">
        <a href="/contact.html">Contact</a>
        <a href="/privacy.html">Privacy</a>
        <a href="/terms.html">Terms</a>
        <span>© 2026 FortMilo</span>
      </nav>
    </div>
  </footer>`;

const readText = (relativePath) => readFile(path.join(ROOT, relativePath), "utf8");

const pick = (html, expression, label, filePath) => {
  const match = html.match(expression);
  if (!match) throw new Error(`${filePath}: missing ${label}`);
  return match[1];
};

const render = ({ spec, source, cssHash }) => {
  const title = pick(source, /<title>([\s\S]*?)<\/title>/u, "title", spec.path);
  const description = pick(source, /<meta name="description" content="([^"]*)">/u, "description", spec.path);
  const main = pick(source, /(<main id="main">[\s\S]*?<\/main>)/u, "main landmark", spec.path);
  const canonical = `https://fortmilo.co.uk${spec.canonical}`;

  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="author" content="FortMilo">
  <meta name="theme-color" content="#07101d">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/svg+xml" href="/assets/fortmilo-mark.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32x32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <meta property="og:type" content="${spec.ogType}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:locale" content="en_GB">
  <meta property="og:image" content="https://fortmilo.co.uk/assets/fortmilo-social.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="FortMilo logo and Security Observatory title">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/styles.css?v=${cssHash}">
</head>
<body class="${spec.bodyClass}">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="/" aria-label="FortMilo home"><img src="/assets/fortmilo-logo.svg" alt="FortMilo" width="860" height="240"></a>
      <nav class="corporate-nav" aria-label="Corporate navigation">${corporateNav(spec.corporate)}</nav>
    </div>
    ${productNav(spec.product)}
  </header>
  ${main}
${footer}
</body>
</html>
`;
};

const normaliseTarget = (href, sourcePath) => {
  const clean = href.split("#", 1)[0].split("?", 1)[0];
  if (!clean || /^(?:https?:|mailto:|tel:)/u.test(clean)) return null;
  if (clean === "/") return "index.html";
  if (clean.endsWith("/")) return `${clean.slice(1)}index.html`;
  if (clean.startsWith("/")) return clean.slice(1);
  return path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), clean));
};

const validate = async (outputs, cssHash) => {
  const known = new Set([...outputs.keys(), "styles.css", "favicon.ico", "site.webmanifest", "assets/fortmilo-logo.svg", "assets/fortmilo-mark.svg", "assets/fortmilo-social.png", "assets/favicon-32x32.png", "assets/apple-touch-icon.png"]);
  const forbidden = [
    ["formal product misname", /FortMilo Security Observatory/u],
    ["unsupported alignment claim", /SBS-aligned/iu],
    ["obsolete cache token", /nav-fix/iu],
    ["AI wording", /\b(?:AI|GPT|Claude|Gemini)\b/u]
  ];

  for (const [filePath, html] of outputs) {
    if (!html.includes('<main id="main">')) throw new Error(`${filePath}: missing #main`);
    if (!html.includes(`/styles.css?v=${cssHash}`)) throw new Error(`${filePath}: stale CSS token`);
    if (!html.includes('property="og:image"')) throw new Error(`${filePath}: missing social metadata`);
    if (!html.includes('rel="apple-touch-icon"')) throw new Error(`${filePath}: missing Apple icon`);
    for (const [label, expression] of forbidden) {
      if (expression.test(html)) throw new Error(`${filePath}: ${label}`);
    }
    for (const [, href] of html.matchAll(/href="([^"]+)"/gu)) {
      const target = normaliseTarget(href, filePath);
      if (target && !known.has(target)) throw new Error(`${filePath}: broken internal link ${href}`);
    }
  }

  const css = await readText("styles.css");
  if (!css.includes("prefers-reduced-motion")) throw new Error("styles.css: reduced-motion support missing");
  if (/<script\b/iu.test([...outputs.values()].join("\n"))) throw new Error("external or inline scripts are not permitted");
};

const buildSitemap = () => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.filter((page) => page.sitemap !== false).map((page) => `  <url><loc>https://fortmilo.co.uk${page.canonical}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}
</urlset>
`;

const main = async () => {
  const css = await readText("styles.css");
  const cssHash = createHash("sha256").update(css).digest("hex").slice(0, 12);
  const outputs = new Map();

  for (const spec of pages) {
    const source = await readText(spec.path);
    outputs.set(spec.path, render({ spec, source, cssHash }));
  }

  await validate(outputs, cssHash);
  const sitemap = buildSitemap();

  if (CHECK) {
    for (const [filePath, expected] of outputs) {
      const actual = await readText(filePath);
      if (actual !== expected) throw new Error(`${filePath}: generated output is stale`);
    }
    if (await readText("sitemap.xml") !== sitemap) throw new Error("sitemap.xml: generated output is stale");
    console.log(`Validated ${outputs.size} pages; CSS token ${cssHash}; no external scripts or analytics.`);
    return;
  }

  await Promise.all([...outputs].map(([filePath, html]) => writeFile(path.join(ROOT, filePath), html)));
  await writeFile(path.join(ROOT, "sitemap.xml"), sitemap);
  console.log(`Generated ${outputs.size} pages; CSS token ${cssHash}.`);
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
