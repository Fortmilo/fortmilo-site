function regexWithGlobal(pattern) {
  return new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
}

export function occurrenceCount(value, marker) {
  if (typeof marker === "string") return marker ? value.split(marker).length - 1 : 0;
  return [...value.matchAll(regexWithGlobal(marker))].length;
}

export function replaceExactly(value, marker, replacement, label, expectedCount = 1) {
  const count = occurrenceCount(value, marker);
  if (count !== expectedCount) throw new Error(`${label}: expected ${expectedCount} source occurrence(s), found ${count}`);
  if (!count) return value;
  return value.replace(typeof marker === "string" ? marker : regexWithGlobal(marker), replacement);
}

function navigationBlock(html, className) {
  const pattern = new RegExp(`<nav\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/nav>`, "iu");
  return pattern.exec(html)?.[0] || "";
}

export function navigationStateErrors(html, route) {
  const errors = [];
  const corporate = navigationBlock(html, "corporate-nav");
  const product = navigationBlock(html, "product-nav");
  if (!corporate) errors.push("missing corporate navigation");
  const corporateCurrent = occurrenceCount(corporate, /\baria-current=["']page["']/iu);
  const expectedCorporate = route.corporateActive ? 1 : 0;
  if (corporateCurrent !== expectedCorporate) errors.push(`expected ${expectedCorporate} corporate current-page state, found ${corporateCurrent}`);
  const productCurrent = occurrenceCount(product, /\baria-current=["']page["']/iu);
  const expectedProduct = route.productActive ? 1 : 0;
  if (productCurrent !== expectedProduct) errors.push(`expected ${expectedProduct} product current-page state, found ${productCurrent}`);
  if (Boolean(product) !== Boolean(route.productActive)) errors.push("product navigation presence differs from route contract");
  return errors;
}
