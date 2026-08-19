export const prohibitedFormalNames = [
  "FortMilo Security Observatory",
  "Fortmilo Security Observatory",
  "FORTMILO Security Observatory",
  "Salesforce Security Observatory"
];

export const exceptionalProductName = "Security Observatory by FortMilo";
export const approvedExceptionalNameLocations = new Set();

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

  if (surface.includes(exceptionalProductName) && !approvedExceptionalNameLocations.has(route)) {
    errors.push(`unapproved routine use of exceptional product name ${exceptionalProductName}`);
  }

  return errors;
}
