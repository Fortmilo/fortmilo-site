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

function downloadableDocumentDetails(value) {
  if (typeof value !== "string") return null;
  const clean = value.split(/[?#]/u, 1)[0].replaceAll("\\", "/");
  const fileName = clean.split("/").at(-1) || "";
  const lowerName = fileName.toLowerCase();
  const extension = publicDownloadableDocumentExtensions.find((candidate) => lowerName.endsWith(candidate));
  if (!extension) return null;
  return { value, fileName, stem: fileName.slice(0, -extension.length) };
}

function logicalDocumentName(stem) {
  return stem
    .replace(/^CURRENT_/iu, "")
    .replace(/[-_]v\d+(?:\.\d+)*$/iu, "")
    .toLowerCase();
}

export function publicDocumentPathErrors(paths) {
  const documents = [...paths].map(downloadableDocumentDetails).filter(Boolean);
  const errors = [];

  for (const document of documents) {
    if (/[-_]v\d+(?:\.\d+)*$/iu.test(document.stem)) {
      errors.push(`${document.value}: versioned public downloadable-document filename is prohibited`);
    }
    if (/[-_](?:19|20)\d{2}(?:(?:[-_.]?\d{2}){2})$/u.test(document.stem)) {
      errors.push(`${document.value}: dated public downloadable-document filename is prohibited`);
    }
  }

  for (const document of documents.filter((candidate) => /^CURRENT_/iu.test(candidate.fileName))) {
    const logicalName = logicalDocumentName(document.stem);
    if (documents.some((candidate) => candidate !== document && logicalDocumentName(candidate.stem) === logicalName)) {
      errors.push(`${document.value}: CURRENT_ public alias duplicates another logical document path`);
    }
  }

  return errors;
}

function parseAttributes(tag) {
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

export function publicCopyRevisionErrors(html, publicationDate) {
  const revisions = [...html.matchAll(/\bdata-public-copy-revision\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/giu)]
    .map((match) => match[1] ?? match[2] ?? match[3]);

  return revisions
    .filter((revision) => revision !== publicationDate)
    .map((revision) => `data-public-copy-revision ${revision} does not match current publication date ${publicationDate}`);
}

export function deploymentTriggerPublicationDateErrors(value, publicationDate) {
  const dates = [...value.matchAll(/\b\d{4}-\d{2}-\d{2}\b/gu)].map((match) => match[0]);
  if (dates.length !== 1) return [`expected exactly one deployment-trigger publication date, found ${dates.length}`];
  if (dates[0] !== publicationDate) {
    return [`deployment-trigger publication date ${dates[0]} does not match current publication date ${publicationDate}`];
  }
  return [];
}
