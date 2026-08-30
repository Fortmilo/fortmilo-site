import { createHash } from "node:crypto";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderSitemap, routes } from "../site-src/site-map.mjs";
import { footer, header, iconLinks, socialImageMetadata } from "../site-src/templates.mjs";
import { navigationStateErrors, replaceExactly } from "./build-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const styles = (await readFile(path.join(root, "site-src", "styles.css"), "utf8")).replace(/\r\n?/gu, "\n");
const homeStyles = (await readFile(path.join(root, "site-src", "home.css"), "utf8")).replace(/\r\n?/gu, "\n");
const assetsDirectory = path.join(root, "assets");
const existingCssNames = (await readdir(assetsDirectory)).filter((name) => /^site\.[a-f0-9]{12}\.css$/u.test(name));
const cssHash = createHash("sha256").update(styles).digest("hex").slice(0, 12);
const cssFile = `assets/site.${cssHash}.css`;
await writeFile(path.join(root, cssFile), styles);

const existingHomeCssNames = (await readdir(assetsDirectory)).filter((name) => /^home\.[a-f0-9]{12}\.css$/u.test(name));
const homeCssHash = createHash("sha256").update(homeStyles).digest("hex").slice(0, 12);
const homeCssFile = `assets/home.${homeCssHash}.css`;
await writeFile(path.join(root, homeCssFile), homeStyles);

function replaceHeadAssetMetadata(html, output) {
  const sharedLines = [
    [/^\s*<link rel="icon"[^>]*>\r?\n/gmu, 5, "favicon metadata"],
    [/^\s*<link rel="apple-touch-icon"[^>]*>\r?\n/gmu, 1, "Apple touch icon metadata"],
    [/^\s*<link rel="manifest"[^>]*>\r?\n/gmu, 1, "web manifest metadata"],
    [/^\s*<meta name="msapplication-(?:TileColor|TileImage)"[^>]*>\r?\n/gmu, 2, "Microsoft tile metadata"],
    [/^\s*<meta property="og:site_name"[^>]*>\r?\n/gmu, 1, "Open Graph site name"],
    [/^\s*<meta property="og:image(?::(?:type|width|height|alt))?"[^>]*>\r?\n/gmu, 5, "Open Graph image metadata"],
    [/^\s*<meta name="twitter:(?:card|image|image:alt)"[^>]*>\r?\n/gmu, 3, "Twitter image metadata"]
  ];
  for (const [pattern, count, label] of sharedLines) html = replaceExactly(html, pattern, "", `${output}: ${label}`, count);

  const canonicalPattern = /^(\s*<link rel="canonical"[^>]*>)$/mu;
  const isNotFound = output === "404.html";
  if (isNotFound) {
    html = replaceExactly(html, /^\s*<link rel="canonical"[^>]*>\r?\n/gmu, "", `${output}: canonical metadata`, 0);
    const noindexPattern = /^(\s*<meta name="robots" content="noindex">)$/mu;
    html = replaceExactly(html, noindexPattern, `$1\n${iconLinks()}`, `${output}: noindex metadata`);
  } else {
    html = replaceExactly(html, canonicalPattern, `$1\n${iconLinks()}`, `${output}: canonical metadata`);
  }

  const ogUrlPattern = /^(\s*<meta property="og:url"[^>]*>)$/mu;
  return replaceExactly(html, ogUrlPattern, `$1\n${socialImageMetadata()}`, `${output}: og:url metadata`);
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
  html = replaceExactly(html, /<link rel="stylesheet" href="\/assets\/site\.[a-f0-9]{12}\.css">/u, `<link rel="stylesheet" href="/${cssFile}">`, `${route.output}: shared stylesheet`);
  html = replaceExactly(html, /^\s*<link rel="stylesheet" data-page-style="home"[^>]*>\n?/gmu, "", `${route.output}: home stylesheet`, route.output === "index.html" ? 1 : 0);
  if (route.output === "index.html") {
    html = replaceExactly(html, `<link rel="stylesheet" href="/${cssFile}">`, `<link rel="stylesheet" href="/${cssFile}">\n  <link rel="stylesheet" data-page-style="home" href="/${homeCssFile}">`, `${route.output}: home stylesheet insertion`);
  }
  html = replaceExactly(html, /<header class="site-header">[\s\S]*?<\/header>/u, header(route), `${route.output}: shared header`);
  html = replaceExactly(html, /<footer class="site-footer">[\s\S]*?<\/footer>/u, footer(), `${route.output}: shared footer`);
  const navigationErrors = navigationStateErrors(html, route);
  if (navigationErrors.length) throw new Error(`${route.output}: ${navigationErrors.join("; ")}`);
  await writeFile(output, html, "utf8");
}

await writeFile(path.join(root, "sitemap.xml"), renderSitemap());
await writeFile(path.join(root, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: https://fortmilo.co.uk/sitemap.xml\n");
await writeFile(path.join(root, ".nojekyll"), "");
await writeFile(path.join(root, "CNAME"), "fortmilo.co.uk\n");
console.log(`Built shared layout for ${routes.length} pages with ${cssFile} and ${homeCssFile}`);
