import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlFiles = [];
async function walk(dir) {
  for (const name of await readdir(dir)) {
    if (["site-src", "scripts", ".git"].includes(name)) continue;
    const full = path.join(dir, name);
    const info = await stat(full);
    if (info.isDirectory()) await walk(full);
    else if (name.endsWith(".html")) htmlFiles.push(full);
  }
}
await walk(root);
const errors = [];
const banned = [
  /\bPass\b/u,
  /\bFail\b/u,
  /SBS-aligned/iu,
  /FortMilo Security Observatory/iu,
  /Salesforce Security Observatory/iu,
  /nav-fix/iu,
  /font-weight:\s*750/iu,
  /GPT|Codex|Claude|Gemini/iu
];
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const rel = path.relative(root, file);
  if ((html.match(/<h1\b/gu) || []).length !== 1) errors.push(`${rel}: expected one h1`);
  for (const required of ["<title>", 'rel="canonical"', 'property="og:image"', 'name="twitter:image"', 'rel="stylesheet"']) {
    if (!html.includes(required)) errors.push(`${rel}: missing ${required}`);
  }
  for (const pattern of banned) if (pattern.test(html)) errors.push(`${rel}: banned text ${pattern}`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/gu)].map((m) => m[1]);
  if (new Set(ids).size !== ids.length) errors.push(`${rel}: duplicate id`);
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/gu)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|#)/u.test(target)) continue;
    const clean = target.split(/[?#]/u)[0];
    const resolved = clean.startsWith("/") ? path.join(root, clean) : path.resolve(path.dirname(file), clean);
    let candidate = resolved;
    if (clean.endsWith("/")) candidate = path.join(resolved, "index.html");
    try { await access(candidate); } catch { errors.push(`${rel}: broken local reference ${target}`); }
  }
}
const contact = await readFile(path.join(root, "contact.html"), "utf8");
for (const text of ["Luca Pacini", "Individual applicant and operator of FortMilo Lab", "Harpenden, Hertfordshire, United Kingdom", "info@fortmilo.co.uk", "FortMilo Lab is an independent personal project and brand operated by Luca Pacini."]) {
  if (!contact.includes(text)) errors.push(`contact.html: missing ${text}`);
}
for (const required of ["privacy.html", "terms.html", "assets/fortmilo-security-observatory-og.png", "favicon.ico", "assets/apple-touch-icon.png", "site.webmanifest"]) {
  try { await access(path.join(root, required)); } catch { errors.push(`missing ${required}`); }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Validated ${htmlFiles.length} HTML files with no errors.`);
