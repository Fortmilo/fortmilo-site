import { createHash } from "node:crypto";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routes } from "../site-src/site-map.mjs";
import { footer, header, iconLinks, socialImageMetadata } from "../site-src/templates.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const styles = await readFile(path.join(root, "site-src", "styles.css"), "utf8");
const homeStyles = await readFile(path.join(root, "site-src", "home.css"), "utf8");
const assetsDirectory = path.join(root, "assets");
const existingCssNames = (await readdir(assetsDirectory)).filter((name) => /^site\.[a-f0-9]{12}\.css$/u.test(name));
let cssFile;
for (const name of existingCssNames) {
  if ((await readFile(path.join(assetsDirectory, name), "utf8")) === styles) {
    cssFile = `assets/${name}`;
    break;
  }
}
if (!cssFile) {
  const hash = createHash("sha256").update(styles).digest("hex").slice(0, 12);
  cssFile = `assets/site.${hash}.css`;
  await writeFile(path.join(root, cssFile), styles);
}

const existingHomeCssNames = (await readdir(assetsDirectory)).filter((name) => /^home\.[a-f0-9]{12}\.css$/u.test(name));
let homeCssFile;
for (const name of existingHomeCssNames) {
  if ((await readFile(path.join(assetsDirectory, name), "utf8")) === homeStyles) {
    homeCssFile = `assets/${name}`;
    break;
  }
}
if (!homeCssFile) {
  const hash = createHash("sha256").update(homeStyles).digest("hex").slice(0, 12);
  homeCssFile = `assets/home.${hash}.css`;
  await writeFile(path.join(root, homeCssFile), homeStyles);
}

function replaceHeadAssetMetadata(html, output) {
  const sharedLines = [
    /^\s*<link rel="icon"[^>]*>\r?\n/gmu,
    /^\s*<link rel="apple-touch-icon"[^>]*>\r?\n/gmu,
    /^\s*<link rel="manifest"[^>]*>\r?\n/gmu,
    /^\s*<meta name="msapplication-(?:TileColor|TileImage)"[^>]*>\r?\n/gmu,
    /^\s*<meta property="og:site_name"[^>]*>\r?\n/gmu,
    /^\s*<meta property="og:image(?::(?:type|width|height|alt))?"[^>]*>\r?\n/gmu,
    /^\s*<meta name="twitter:(?:card|image|image:alt)"[^>]*>\r?\n/gmu
  ];
  for (const pattern of sharedLines) html = html.replace(pattern, "");

  const canonicalPattern = /^(\s*<link rel="canonical"[^>]*>)$/mu;
  const isNotFound = output === "404.html";
  if (isNotFound) {
    html = html.replace(/^\s*<link rel="canonical"[^>]*>\r?\n/gmu, "");
    const noindexPattern = /^(\s*<meta name="robots" content="noindex">)$/mu;
    if (!noindexPattern.test(html)) throw new Error(`${output}: missing noindex metadata`);
    html = html.replace(noindexPattern, `$1\n${iconLinks()}`);
  } else {
    if (!canonicalPattern.test(html)) throw new Error(`${output}: missing canonical link`);
    html = html.replace(canonicalPattern, `$1\n${iconLinks()}`);
  }

  const ogUrlPattern = /^(\s*<meta property="og:url"[^>]*>)$/mu;
  if (!ogUrlPattern.test(html)) throw new Error(`${output}: missing og:url`);
  return html.replace(ogUrlPattern, `$1\n${socialImageMetadata()}`);
}

for (const name of existingCssNames) {
  if (`assets/${name}` !== cssFile) await rm(path.join(assetsDirectory, name));
}
for (const name of existingHomeCssNames) {
  if (`assets/${name}` !== homeCssFile) await rm(path.join(assetsDirectory, name));
}

for (const route of routes) {
  const output = path.join(root, route.output);
  let html = await readFile(output, "utf8");
  html = html.replace(/\r\n?/gu, "\n");
  html = replaceHeadAssetMetadata(html, route.output);
  html = html.replace(/<link rel="stylesheet" href="\/assets\/site\.[a-f0-9]{12}\.css">/u, `<link rel="stylesheet" href="/${cssFile}">`);
  html = html.replace(/^\s*<link rel="stylesheet" data-page-style="home"[^>]*>\n?/gmu, "");
  if (route.output === "index.html") {
    html = html.replace(`<link rel="stylesheet" href="/${cssFile}">`, `<link rel="stylesheet" href="/${cssFile}">\n  <link rel="stylesheet" data-page-style="home" href="/${homeCssFile}">`);
  }
  html = html.replace(/<header class="site-header">[\s\S]*?<\/header>/u, header(route));
  html = html.replace(/<footer class="site-footer">[\s\S]*?<\/footer>/u, footer());
  await writeFile(output, html, "utf8");
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.filter((route) => !route.noindex).map((route) => `  <url><loc>${route.canonical}</loc><lastmod>${route.lastmod}</lastmod></url>`).join("\n")}\n</urlset>\n`;
await writeFile(path.join(root, "sitemap.xml"), sitemap);
await writeFile(path.join(root, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: https://fortmilo.co.uk/sitemap.xml\n");
await writeFile(path.join(root, ".nojekyll"), "");
await writeFile(path.join(root, "CNAME"), "fortmilo.co.uk\n");
console.log(`Built shared layout for ${routes.length} pages with ${cssFile} and ${homeCssFile}`);
