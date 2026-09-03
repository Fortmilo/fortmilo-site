export const prohibitedFormalNames = [
  "FortMilo",
  "FORTMILO",
  "Fortmilo Security Observatory",
  "Salesforce Security Observatory"
];

export const attributedProductName = "Security Observatory by Fortmilo";

export const issue32Contract = Object.freeze({
  homepageTitle: "Security Observatory by Fortmilo | Read-only Salesforce evidence",
  homepageDescription: "Review application, identity and integration exposure with read-only, sanitised security evidence retained in your Salesforce org.",
  homepageSchemaDescription: "Fortmilo develops Security Observatory for read-only review of application, identity and integration exposure with sanitised evidence retained in Salesforce.",
  homepageHeadline: "See what can reach your Salesforce org — and keep the evidence needed to review it.",
  homepageSupport: "Free, read-only visibility into application, identity and integration exposure, with sanitised evidence retained in your Salesforce org.",
  applicationGovernance: "Every application we observe gets a durable record you can own, review and trace back to evidence.",
  trustStrip: "No tokens · No session IDs · No secrets · No certificate bodies · No raw IPs",
  neutralRelationship: "Designed to complement Salesforce's native security capabilities, not replace them.",
  overviewTitle: "Security Observatory overview | Fortmilo",
  overviewDescription: "Review application governance, OAuth exposure, identity and integration evidence with a read-only, evidence-bounded Salesforce assessment.",
  v1Date: "V1 scope current as of 3 September 2026.",
  futureDirection: "Paid extensions for continuous monitoring, longer evidence history and estate-wide governance are under consideration for a later release.",
  packageLicenceBoundary: "Package Licence capacity evidence is available for managed packages that expose a Salesforce PackageLicense record. This is not a complete installed-package inventory.",
  partnerFooter: "Fortmilo participates in the Salesforce Partner Program. Partner status does not imply Salesforce endorsement, AppExchange listing or completion of Salesforce Security Review. Security Observatory is independently developed and is not endorsed by Salesforce, Inc. Salesforce is a trademark of Salesforce, Inc.",
  visibleEmail: "info@fortmilo.co.uk"
});

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
  const errors = [];
  const withoutComments = html.replace(/<!--[\s\S]*?-->/gu, " ");
  const jsonLd = [...withoutComments.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu)]
    .map((match) => match[1]);
  const textSegments = withoutComments
    .replace(/<script\b[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[\s\S]*?<\/style>/giu, " ")
    .split(/<[^>]+>/gu)
    .map((value) => value.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
  const surfaces = [...textSegments, ...metadataValues(withoutComments), ...jsonLd];

  for (const name of prohibitedFormalNames) {
    if (surfaces.some((surface) => surface.includes(name))) errors.push(`prohibited customer-visible name ${name}`);
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

function occurrenceCount(value, needle) {
  return value.split(needle).length - 1;
}

function requiredOccurrence(errors, surface, needle, count, label) {
  const actual = occurrenceCount(surface, needle);
  if (actual !== count) errors.push(`${label} must appear exactly ${count === 1 ? "once" : `${count} times`}, found ${actual}`);
}

function metadataContent(html, key) {
  for (const match of html.matchAll(/<meta\b[^>]*>/giu)) {
    const attributes = parseAttributes(match[0]);
    const candidate = (attributes.get("name") || attributes.get("property") || "").toLowerCase();
    if (candidate === key.toLowerCase()) return attributes.get("content") || "";
  }
  return "";
}

export function issue32PositioningErrors(html, route) {
  const surface = customerVisibleSurface(html);
  const lowerSurface = surface.toLowerCase();
  const errors = [];

  if (surface.includes(issue32Contract.futureDirection) && route !== "security-observatory/index.html") {
    errors.push("future-direction statement is allowed only on the product Overview");
  }
  if (surface.includes(issue32Contract.trustStrip) && !["index.html", "security-observatory/index.html"].includes(route)) {
    errors.push("exact trust strip is allowed only on Home and product Overview");
  }

  requiredOccurrence(errors, surface, issue32Contract.partnerFooter, 1, "qualified Partner Program footer");
  if (!surface.includes(issue32Contract.visibleEmail)) errors.push("visible info@fortmilo.co.uk fallback is missing");

  const privateIdentifierPatterns = [
    /C:\\Users\\/iu,
    /\b[0-9a-f]{40}\b/iu,
    /\borigin\/[a-z0-9._/-]+\b/iu,
    /\b(?:private|internal).{0,32}\b(?:repository|repo|branch|source path|filesystem path|commit|sha)\b/iu,
    /\b(?:application|claim-review)\s+SHA\b/iu
  ];
  for (const pattern of privateIdentifierPatterns) {
    if (pattern.test(surface)) errors.push(`private application identifier matches ${pattern}`);
  }

  const prohibitedPatterns = [
    [/Security Center Essentials/iu, "named Security Center product comparison"],
    [/full Security Center/iu, "named Security Center version comparison"],
    [/Compare capabilities/iu, "Compare capabilities CTA"],
    [/comparison table/iu, "comparison-table wording"],
    [/\b(?:winner|trophy|scoreboard)\b/iu, "winner/trophy/scoreboard wording"],
    [/\b(?:same as|better than|beats|more complete than|superior to)\b/iu, "superiority claim"],
    [/Salesforce.{0,24}\bpricing\b/iu, "Salesforce pricing claim"],
    [/\b(?:replacement for|alternative to|substitute for)\s+(?:Salesforce|Salesforce's|native Salesforce)/iu, "replacement claim"],
    [/\b(?:replaces?|replacing)\s+(?:Salesforce|Salesforce's|native Salesforce)/iu, "replacement claim"],
    [/<table\b[^>]*(?:class|id)=["'][^"']*(?:comparison|compare)[^"']*["']/iu, "comparison table markup"],
    [/\b(?:includes?|covers?|inventories|scans?)\s+External Client Apps?\b/iu, "External Client App V1 coverage claim"],
    [/External Client App inventory\s+(?:is|forms|provides)\s+(?:included|available|supported|part)/iu, "External Client App V1 coverage claim"],
    [/\bfrozen-user session (?:findings?|coverage)\s+(?:is|are)\s+(?:included|available|supported)/iu, "frozen-user session claim"],
    [/\b(?:finds?|flags?|detects?|surfaces?)\s+(?:current\s+)?sessions?\s+(?:for|held by)\s+frozen/iu, "frozen-user session claim"],
    [/\bSBS\b[^.]{0,80}\b(?:is|are)\s+(?:now\s+)?release-complete/iu, "release-complete SBS claim"],
    [/\b(?:Security Observatory|the product|Free V1|V1)\s+(?:is|provides|offers|delivers|ensures|guarantees)\s+(?:fully\s+)?(?:compliant|certified|complete|comprehensive|exhaustive|real[- ]?time)\b/iu, "unsupported absolute product claim"],
    [/\b(?:guarantees?|proves?)\s+(?:a\s+)?clean\s+(?:result|state|bill of health)\b/iu, "unsupported clean-result claim"],
    [/\b(?:now|currently)\s+available for public installation\b/iu, "public-installation claim"],
    [/\b(?:passed|completed|has completed)\s+Salesforce Security Review\b/iu, "Security Review completion claim"]
  ];
  for (const [pattern, label] of prohibitedPatterns) {
    if (pattern.test(html) || pattern.test(surface)) errors.push(`prohibited ${label}`);
  }

  const withoutNeutralRelationship = surface.replaceAll(issue32Contract.neutralRelationship, "");
  if (/\b(?:complements?|replaces?|replacement|alternative|substitute)\b.{0,80}\bSalesforce\b/iu.test(withoutNeutralRelationship) || /\bSalesforce\b.{0,80}\b(?:complements?|replaces?|replacement|alternative|substitute)\b/iu.test(withoutNeutralRelationship)) {
    errors.push("unapproved Salesforce product-relationship claim");
  }

  if (route === "index.html") {
    requiredOccurrence(errors, surface, issue32Contract.homepageHeadline, 1, "approved homepage headline");
    requiredOccurrence(errors, surface, issue32Contract.homepageSupport, 1, "approved homepage support copy");
    requiredOccurrence(errors, surface, issue32Contract.applicationGovernance, 1, "application-governance line");
    requiredOccurrence(errors, surface, issue32Contract.trustStrip, 1, "homepage trust strip");
    requiredOccurrence(errors, surface, issue32Contract.neutralRelationship, 1, "neutral Salesforce relationship statement");
    for (const cta of ["Explore Security Observatory", "Request access when available"]) {
      if (!surface.includes(cta)) errors.push(`homepage missing ${cta} CTA`);
    }
    requiredOccurrence(errors, surface, issue32Contract.homepageSchemaDescription, 1, "homepage schema description");
    for (const heading of ["Baseline visibility included", "Where Security Observatory goes deeper", "How your evidence is handled"]) {
      requiredOccurrence(errors, surface, heading, 1, `${heading} heading`);
    }
    const headingPositions = ["Baseline visibility included", "Where Security Observatory goes deeper", "How your evidence is handled"].map((heading) => surface.indexOf(heading));
    if (!(headingPositions[0] < headingPositions[1] && headingPositions[1] < headingPositions[2])) errors.push("outcome-led sections are not adjacent and ordered");
    const title = /<title>(.*?)<\/title>/iu.exec(html)?.[1] || "";
    if (title !== issue32Contract.homepageTitle) errors.push("homepage title metadata does not match the approved positioning");
    for (const key of ["description", "og:description"]) {
      if (metadataContent(html, key) !== issue32Contract.homepageDescription) errors.push(`homepage ${key} metadata does not match visible positioning`);
    }
  }

  if (route === "security-observatory/index.html") {
    requiredOccurrence(errors, surface, issue32Contract.trustStrip, 1, "Overview trust strip");
    requiredOccurrence(errors, surface, "V1 limitations", 1, "V1 limitations heading");
    requiredOccurrence(errors, surface, issue32Contract.v1Date, 1, "dated V1 scope marker");
    requiredOccurrence(errors, surface, issue32Contract.futureDirection, 1, "future-direction statement");
    requiredOccurrence(errors, surface, issue32Contract.packageLicenceBoundary, 1, "PackageLicense boundary");
    for (const value of [
      "Free V1 is single-org.",
      "read-only and advisory",
      "performs no automatic remediation",
      "does not revoke tokens, remove permissions or alter assessed endpoints or Salesforce security configuration",
      "1–10 retained completed scans",
      "Developer Edition 1, Sandbox 3 and Production 3",
      "OAuth usage rows follow scan-retention cleanup",
      "1,000 retained records per family",
      "Package Licences",
      "Permission Set Licences",
      "Salesforce User Licences",
      "External Client App inventory is not included in V1.",
      "subscriber to complete self-callout setup",
      "SBS mapping is not promoted as release-complete",
      "The asset and governance CSV does not export the complete governance record.",
      "Unavailable or incomplete evidence is not presented as zero."
    ]) {
      if (!surface.includes(value)) errors.push(`Overview missing ${value}`);
    }
    if (!surface.includes("Request access when available")) errors.push("Overview missing request-access CTA");
    const limitationsPosition = surface.indexOf("V1 limitations");
    const futurePosition = surface.indexOf(issue32Contract.futureDirection);
    if (limitationsPosition < 0 || futurePosition <= limitationsPosition) errors.push("future direction must occur after V1 limitations");
    const title = /<title>(.*?)<\/title>/iu.exec(html)?.[1] || "";
    if (title !== issue32Contract.overviewTitle) errors.push("Overview title metadata does not match the approved positioning");
    for (const key of ["description", "og:description"]) {
      if (metadataContent(html, key) !== issue32Contract.overviewDescription) errors.push(`Overview ${key} metadata does not match visible positioning`);
    }
  }

  if (route === "security-observatory/entitlements-assets.html") {
    requiredOccurrence(errors, surface, issue32Contract.packageLicenceBoundary, 1, "Entitlements PackageLicense boundary");
  }

  if (route === "security-observatory/evidence.html" && !lowerSurface.includes("mapping work remains partial and open")) {
    errors.push("SBS partial/open qualification is missing");
  }

  return errors;
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
