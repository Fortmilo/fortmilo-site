export const prohibitedFormalNames = [
  "FortMilo",
  "FORTMILO",
  "Fortmilo Security Observatory",
  "Salesforce Security Observatory"
];

export const attributedProductName = "Security Observatory by Fortmilo";

export const publicDownloadableDocumentExtensions = Object.freeze([
  ".pdf",
  ".svg",
  ".md",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx"
]);

export const prohibitedEvidenceClaims = [
  ["Coverage type describes evidence", "detail level"].join(" "),
  ["Partial Evidence outcome", "tiles"].join(" "),
  ["run, scope or evidence", "detail level"].join(" "),
  ["CSV generation remains inside", "Salesforce"].join(" "),
  ["Collection, retention, review and CSV generation occur inside", "the subscriber Salesforce organisation"].join(" "),
  ["some usable assignment evidence was retained, but", "the full population could not be retained safely"].join(" "),
  ["Missing scope identified separately as Not assessed or", "Unavailable"].join(" ")
];

export const prohibitedPublicClaims = Object.freeze([
  "Salesforce approved",
  "Salesforce certified",
  "Salesforce recommended",
  "Salesforce sponsored Security Observatory",
  "AppExchange approved",
  "AppExchange certified",
  "AppExchange listed"
]);

function downloadableDocumentDetails(value) {
  if (typeof value !== "string") return null;
  const clean = value.split(/[?#]/u, 1)[0].replaceAll("\\", "/");
  const fileName = clean.split("/").at(-1) || "";
  const lowerName = fileName.toLowerCase();
  const extension = publicDownloadableDocumentExtensions.find((candidate) => lowerName.endsWith(candidate));
  if (!extension) return null;
  return { value, fileName, stem: fileName.slice(0, -extension.length) };
}

export function publicDocumentPathErrors(paths) {
  const documents = [...paths].map(downloadableDocumentDetails).filter(Boolean);
  const errors = [];

  for (const document of documents) {
    if (/^CURRENT_/iu.test(document.fileName)) {
      errors.push(`${document.value}: CURRENT_ public downloadable-document filename is prohibited`);
    }
    if (/[-_]v\d+(?:\.\d+)*$/iu.test(document.stem)) {
      errors.push(`${document.value}: versioned public downloadable-document filename is prohibited`);
    }
    if (/[-_](?:19|20)\d{2}(?:(?:[-_.]?\d{2}){2})$/u.test(document.stem)) {
      errors.push(`${document.value}: dated public downloadable-document filename is prohibited`);
    }
  }

  return errors;
}

export function parseAttributes(tag) {
  const attributes = new Map();
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gu)) {
    attributes.set(match[1].toLowerCase(), match[3]);
  }
  return attributes;
}

function metadataValues(html) {
  const values = [];
  const allowedMetaKeys = new Set([
    "description",
    "og:description",
    "og:title",
    "og:image:alt",
    "twitter:image:alt"
  ]);

  for (const match of html.matchAll(/<meta\b[^>]*>/giu)) {
    const attributes = parseAttributes(match[0]);
    const key = (attributes.get("name") || attributes.get("property") || "").toLowerCase();
    if (allowedMetaKeys.has(key) && attributes.has("content")) values.push(attributes.get("content"));
  }

  for (const match of html.matchAll(/<[^>]+>/gu)) {
    const attributes = parseAttributes(match[0]);
    for (const key of ["alt", "aria-label"]) {
      if (attributes.has(key)) values.push(attributes.get(key));
    }
  }

  return values;
}

export function customerVisibleSurface(html) {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/gu, " ");
  const jsonLd = [...withoutComments.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu)]
    .map((match) => match[1]);
  const withoutScriptsAndStyles = withoutComments
    .replace(/<script\b[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[\s\S]*?<\/style>/giu, " ");
  const textNodes = withoutScriptsAndStyles.replace(/<[^>]+>/gu, " ");

  return [textNodes, ...metadataValues(withoutComments), ...jsonLd]
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function headingErrors(html) {
  const headingLevels = [...html.matchAll(/<h([1-6])\b[^>]*>/giu)].map((match) => Number(match[1]));
  const errors = [];
  const h1Count = headingLevels.filter((level) => level === 1).length;

  if (h1Count !== 1) errors.push(`expected exactly one H1, found ${h1Count}`);
  if (headingLevels.length && headingLevels[0] !== 1) errors.push("H1 must be first heading");

  for (let index = 1; index < headingLevels.length; index += 1) {
    if (headingLevels[index] > headingLevels[index - 1] + 1) {
      errors.push(`skipped H${headingLevels[index - 1]} to H${headingLevels[index]}`);
    }
  }

  return errors;
}

export function namingErrors(html, route) {
  const surface = customerVisibleSurface(html);
  const errors = [];

  for (const name of prohibitedFormalNames) {
    if (surface.includes(name)) errors.push(`prohibited customer-visible name ${name}`);
  }

  return errors;
}

export function evidenceTerminologyErrors(value) {
  const errors = [];

  for (const claim of prohibitedEvidenceClaims) {
    if (value.toLowerCase().includes(claim.toLowerCase())) {
      errors.push(`prohibited evidence-semantics claim ${claim}`);
    }
  }

  return errors;
}

export function prohibitedPublicClaimErrors(value) {
  const surface = customerVisibleSurface(value).toLowerCase();
  return prohibitedPublicClaims
    .filter((claim) => surface.includes(claim.toLowerCase()))
    .map((claim) => `prohibited public claim ${claim}`);
}

export function uniqueIdErrors(markup) {
  const seen = new Set();
  const errors = [];
  for (const match of markup.matchAll(/\bid\s*=\s*(["'])(.*?)\1/giu)) {
    const id = match[2];
    if (!id) errors.push("empty id attribute");
    else if (seen.has(id)) errors.push(`duplicate id ${id}`);
    else seen.add(id);
  }
  return errors;
}

export function landmarkErrors(html) {
  const errors = [];
  const count = (pattern) => [...html.matchAll(pattern)].length;
  if (count(/<a\b[^>]*class=["'][^"']*\bskip-link\b[^"']*["'][^>]*href=["']#main["'][^>]*>/giu) !== 1) {
    errors.push("expected exactly one skip link to #main");
  }
  if (count(/<main\b[^>]*\bid=["']main["'][^>]*>/giu) !== 1) errors.push("expected exactly one main landmark with id main");
  if (count(/<header\b[^>]*class=["'][^"']*\bsite-header\b[^"']*["'][^>]*>/giu) !== 1) errors.push("expected exactly one site header landmark");
  if (count(/<footer\b[^>]*class=["'][^"']*\bsite-footer\b[^"']*["'][^>]*>/giu) !== 1) errors.push("expected exactly one site footer landmark");
  if (count(/<nav\b[^>]*aria-label=["'][^"']+["'][^>]*>/giu) < 1) errors.push("expected at least one labelled navigation landmark");
  return errors;
}

export function imageMarkupErrors(html) {
  const errors = [];
  for (const match of html.matchAll(/<img\b[^>]*>/giu)) {
    const attributes = parseAttributes(match[0]);
    const source = attributes.get("src") || "unnamed image";
    if (!attributes.has("alt")) errors.push(`${source}: image is missing alt text`);
    for (const dimension of ["width", "height"]) {
      const value = attributes.get(dimension);
      if (!value || !/^[1-9]\d*$/u.test(value)) errors.push(`${source}: image is missing a positive declared ${dimension}`);
    }
  }
  return errors;
}

export function canonicalMetadataErrors(html, expectedCanonical, { noindex = false } = {}) {
  const canonicalLinks = [...html.matchAll(/<link\b[^>]*\brel=["']canonical["'][^>]*>/giu)];
  if (noindex) return canonicalLinks.length ? ["noindex page must not declare canonical metadata"] : [];
  if (canonicalLinks.length !== 1) return [`expected exactly one canonical link, found ${canonicalLinks.length}`];
  const attributes = parseAttributes(canonicalLinks[0][0]);
  return attributes.get("href") === expectedCanonical ? [] : [`canonical URL must be ${expectedCanonical}`];
}

function textContent(value) {
  return value.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim();
}

export function standaloneSvgAccessibilityErrors(svg) {
  const errors = [];
  const titles = [...svg.matchAll(/<title\b([^>]*)>([\s\S]*?)<\/title>/giu)];
  const descriptions = [...svg.matchAll(/<desc\b([^>]*)>([\s\S]*?)<\/desc>/giu)];
  if (titles.length !== 1) errors.push(`expected exactly one SVG title, found ${titles.length}`);
  if (descriptions.length !== 1) errors.push(`expected exactly one SVG desc, found ${descriptions.length}`);
  const root = /<svg\b[^>]*>/iu.exec(svg)?.[0];
  if (!root) return [...errors, "missing SVG root"];
  const rootAttributes = parseAttributes(root);
  if (rootAttributes.get("role") !== "img") errors.push("SVG root must have role img");
  const labelledBy = (rootAttributes.get("aria-labelledby") || "").split(/\s+/u).filter(Boolean);
  for (const match of [...titles, ...descriptions]) {
    const id = parseAttributes(`<node ${match[1]}>`).get("id");
    if (!id || !labelledBy.includes(id)) errors.push("SVG title and desc IDs must be referenced by aria-labelledby");
  }
  if (titles.length === 1) {
    const title = textContent(titles[0][2]);
    const visibleText = [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/giu)].map((match) => textContent(match[1])).join(" ");
    if (!title || !visibleText.includes(title)) errors.push("SVG title must align with visible diagram text");
  }
  return errors;
}

export function publicCopyRevisionErrors(html, publicationDate) {
  const revisions = [...html.matchAll(/\bdata-public-copy-revision\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/giu)]
    .map((match) => match[1] ?? match[2] ?? match[3]);

  return revisions
    .filter((revision) => revision !== publicationDate)
    .map((revision) => `data-public-copy-revision ${revision} does not match current publication date ${publicationDate}`);
}
