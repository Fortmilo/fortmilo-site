const corporateItems = [
  ["home", "Home", "/"],
  ["observatory", "Security Observatory", "/security-observatory/"],
  ["architecture", "Architecture & Security", "/architecture-security.html"],
  ["contact", "Contact", "/contact.html"]
];

const productItems = [
  ["overview", "Overview", "/security-observatory/"],
  ["findings", "Findings", "/security-observatory/findings.html"],
  ["identity", "Identity & Access", "/security-observatory/identity-access.html"],
  ["connections", "External Connections", "/security-observatory/external-connections.html"],
  ["entitlements", "Entitlements & Assets", "/security-observatory/entitlements-assets.html"],
  ["evidence", "Evidence & Coverage", "/security-observatory/evidence.html"]
];

export const previewImagePath = "/assets/fortmilo-security-observatory-og-20260731.jpg";
export const previewImageUrl = `https://fortmilo.co.uk${previewImagePath}`;
export const previewImageAlt = "FortMilo — Security Observatory";

export function iconLinks() {
  return `  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="msapplication-TileColor" content="#07101d">
  <meta name="msapplication-TileImage" content="/mstile-150x150.png">`;
}

export function socialImageMetadata() {
  return `  <meta property="og:image" content="${previewImageUrl}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${previewImageAlt}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${previewImageUrl}">
  <meta name="twitter:image:alt" content="${previewImageAlt}">`;
}

function nav(items, active, className, label) {
  return `<nav class="${className}" aria-label="${label}">${items.map(([key, text, href]) => `<a${key === active ? ' aria-current="page"' : ''} href="${href}">${text}</a>`).join("")}</nav>`;
}

export function header({ corporateActive, productActive }) {
  return `<header class="site-header"><div class="container header-inner"><a class="brand" href="/" aria-label="FortMilo home"><img src="/assets/fortmilo-shield-512.png" alt="" width="512" height="512"><span>FortMilo</span></a>${nav(corporateItems, corporateActive, "corporate-nav", "Corporate navigation")}</div>${productActive ? `<div class="product-nav-wrap">${nav(productItems, productActive, "product-nav container", "Security Observatory sections")}</div>` : ""}</header>`;
}

export function footer() {
  return `<footer class="site-footer"><div class="container footer-grid"><div><p><strong>Luca Pacini, trading as FortMilo.</strong></p><p>Harpenden, Hertfordshire, United Kingdom.</p><p>Independent of and not endorsed by Salesforce, Inc. Salesforce is a trademark of Salesforce, Inc.</p></div><div><div class="footer-links"><a href="/contact.html">Contact</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="/.well-known/security.txt">Security</a></div><p>© 2026 Luca Pacini. All rights reserved.</p></div></div></footer>`;
}

export function page({ title, description, canonical, corporateActive, productActive, bodyClass = "", body, cssFile, noindex = false }) {
  const fullTitle = title.includes("FortMilo") ? title : `${title} | FortMilo`;
  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${fullTitle}</title>
  <meta name="description" content="${description}">
  ${noindex ? '<meta name="robots" content="noindex">' : ""}
  ${noindex ? "" : `<link rel="canonical" href="${canonical}">`}
${iconLinks()}
  <meta property="og:type" content="website">
  <meta property="og:title" content="${fullTitle}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonical}">
${socialImageMetadata()}
  <meta property="og:locale" content="en_GB">
  <link rel="stylesheet" href="/${cssFile}">
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}>
  <a class="skip-link" href="#main">Skip to content</a>
  ${header({ corporateActive, productActive })}
  <main id="main">${body}</main>
  ${footer()}
</body>
</html>`;
}
