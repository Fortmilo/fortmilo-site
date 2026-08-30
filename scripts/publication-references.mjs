import path from "node:path";

export const productionOrigin = "https://fortmilo.co.uk";

export function publicUrlForFile(file) {
  if (file === "index.html") return "/";
  if (file.endsWith("/index.html")) return `/${file.slice(0, -"index.html".length)}`;
  return `/${file}`;
}

export function publicationFileForPathname(pathname) {
  const relative = pathname.slice(1);
  if (!relative) return "index.html";
  return pathname.endsWith("/") ? `${relative}index.html` : relative;
}

function markupReferences(value) {
  const references = [];
  for (const match of value.matchAll(/\b(?:href|src|poster|action)\s*=\s*(["'])(.*?)\1/giu)) references.push(match[2]);
  for (const match of value.matchAll(/\bsrcset\s*=\s*(["'])(.*?)\1/giu)) {
    for (const candidate of match[2].split(",")) references.push(candidate.trim().split(/\s+/u, 1)[0]);
  }
  for (const match of value.matchAll(/<meta\b[^>]*\bcontent\s*=\s*(["'])(.*?)\1[^>]*>/giu)) {
    if (/^(?:https?:\/\/fortmilo\.co\.uk\/|\/)/u.test(match[2])) references.push(match[2]);
  }
  return references;
}

function markdownReferences(value) {
  return [...value.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/gu)].map((match) => match[1]);
}

function cssReferences(value) {
  return [...value.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/giu)].map((match) => match[2]);
}

export function referencesForPublicationFile(file, value) {
  const extension = path.posix.extname(file).toLowerCase();
  if (extension === ".html") return markupReferences(value);
  if (extension === ".svg") return [...markupReferences(value), ...cssReferences(value)];
  if (extension === ".md") return markdownReferences(value);
  if (extension === ".css") return cssReferences(value);
  if (file === "site.webmanifest") {
    const manifest = JSON.parse(value);
    return [manifest.start_url, manifest.scope, ...(manifest.icons || []).map((icon) => icon.src)].filter(Boolean);
  }
  if (file === "sitemap.xml") return [...value.matchAll(/<loc>(.*?)<\/loc>/gu)].map((match) => match[1]);
  if (file === "robots.txt") return [...value.matchAll(/^Sitemap:\s*(\S+)\s*$/gimu)].map((match) => match[1]);
  if (file === ".well-known/security.txt") return [...value.matchAll(/^Canonical:\s*(\S+)\s*$/gimu)].map((match) => match[1]);
  return [];
}

export function resolvePublicationReference(reference, owner, origin = productionOrigin) {
  const decodedReference = reference.replaceAll("&amp;", "&").trim();
  if (!decodedReference || /^(?:data:|mailto:|tel:|javascript:)/iu.test(decodedReference)) return null;

  let url;
  try {
    url = new URL(decodedReference, new URL(publicUrlForFile(owner), origin));
  } catch {
    return { error: `invalid internal reference ${reference}` };
  }
  if (!/^https?:$/u.test(url.protocol) || url.origin !== origin) return null;

  let pathname;
  let fragment;
  try {
    pathname = decodeURIComponent(url.pathname);
    fragment = url.hash ? decodeURIComponent(url.hash.slice(1)) : "";
  } catch {
    return { error: `invalid percent encoding in ${reference}` };
  }
  if (!pathname.startsWith("/") || pathname.includes("\\")) return { error: `unsafe internal reference ${reference}` };
  return { file: publicationFileForPathname(pathname), fragment };
}

export function markupIds(value) {
  return new Set([...value.matchAll(/\bid\s*=\s*(["'])(.*?)\1/giu)].map((match) => match[2]));
}

export function publicationReferenceErrors(contentsByFile, origin = productionOrigin) {
  const errors = [];
  const files = new Set(contentsByFile.keys());
  const idsByFile = new Map();

  for (const [file, bytes] of contentsByFile) {
    if (/\.(?:html|svg)$/iu.test(file)) idsByFile.set(file, markupIds(Buffer.isBuffer(bytes) ? bytes.toString("utf8") : bytes));
  }

  for (const [file, bytes] of contentsByFile) {
    const value = Buffer.isBuffer(bytes) ? bytes.toString("utf8") : bytes;
    let references;
    try {
      references = referencesForPublicationFile(file, value);
    } catch (error) {
      errors.push(`${file}: cannot parse references (${error.message})`);
      continue;
    }
    for (const reference of references) {
      const target = resolvePublicationReference(reference, file, origin);
      if (!target) continue;
      if (target.error) {
        errors.push(`${file}: ${target.error}`);
        continue;
      }
      if (!files.has(target.file)) {
        errors.push(`${file}: internal reference has no exact case-sensitive artifact target: ${reference}`);
        continue;
      }
      if (target.fragment) {
        const ids = idsByFile.get(target.file);
        if (!ids || !ids.has(target.fragment)) errors.push(`${file}: fragment ${reference} has no target id ${target.fragment}`);
      }
    }
  }

  return errors;
}
