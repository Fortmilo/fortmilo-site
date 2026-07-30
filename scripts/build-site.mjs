import { createHash } from "node:crypto";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routes } from "../site-src/site-map.mjs";
import { footer, header } from "../site-src/templates.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const styles = await readFile(path.join(root, "site-src", "styles.css"), "utf8");
const hash = createHash("sha256").update(styles).digest("hex").slice(0, 12);
const cssFile = `assets/site.${hash}.css`;

for (const name of await readdir(path.join(root, "assets"))) {
  if (/^site\.[a-f0-9]{12}\.css$/u.test(name)) await rm(path.join(root, "assets", name));
}
await writeFile(path.join(root, cssFile), styles);

for (const route of routes) {
  const output = path.join(root, route.output);
  let html = await readFile(output, "utf8");
  html = html.replace(/<link rel="stylesheet" href="\/assets\/site\.[a-f0-9]{12}\.css">/u, `<link rel="stylesheet" href="/${cssFile}">`);
  html = html.replace(/<header class="site-header">[\s\S]*?<\/header>/u, header(route));
  html = html.replace(/<footer class="site-footer">[\s\S]*?<\/footer>/u, footer());
  await writeFile(output, html, "utf8");
}

const lastmod = "2026-07-30";
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.filter((route) => !route.noindex).map((route) => `  <url><loc>${route.canonical}</loc><lastmod>${lastmod}</lastmod></url>`).join("\n")}\n</urlset>\n`;
await writeFile(path.join(root, "sitemap.xml"), sitemap);
await writeFile(path.join(root, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: https://fortmilo.co.uk/sitemap.xml\n");
await writeFile(path.join(root, ".nojekyll"), "");
await writeFile(path.join(root, "CNAME"), "fortmilo.co.uk\n");
console.log(`Built shared layout for ${routes.length} pages with ${cssFile}`);
