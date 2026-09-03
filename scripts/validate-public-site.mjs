import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFString } from "pdf-lib";
import { documentAssets, renderSitemap, routes, sitemapEntries } from "../site-src/site-map.mjs";
import { formatPublicationDate, publicationDateAsUtc, publicationDates } from "../site-src/publication-metadata.mjs";
import { previewImagePath, previewImageUrl, socialImageMetadata } from "../site-src/templates.mjs";
import { navigationStateErrors } from "./build-contract.mjs";
import { socialPreviewAsset, staleGovernedAssetPaths } from "./governed-assets.mjs";
import {
  canonicalMetadataErrors,
  evidenceTerminologyErrors,
  headingErrors,
  imageMarkupErrors,
  issue32PositioningErrors,
  landmarkErrors,
  namingErrors,
  prohibitedPublicClaimErrors,
  publicDocumentPathErrors,
  publicCopyRevisionErrors,
  standaloneSvgAccessibilityErrors,
  uniqueIdErrors
} from "./public-site-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const currentPublicationDate = publicationDates.site;
const errors = [];
const expectedSocialMetadata = socialImageMetadata().split("\n").map((line) => line.trim()).filter(Boolean);
const sharedStyles = (await readFile(path.join(root, "site-src", "styles.css"), "utf8")).replace(/\r\n?/gu, "\n");
const sharedStylesheetHref = `/assets/site.${createHash("sha256").update(sharedStyles).digest("hex").slice(0, 12)}.css`;
const tabletStylesStart = sharedStyles.indexOf("@media (max-width: 900px) {");
const mobileStylesStart = sharedStyles.indexOf("@media (max-width: 620px) {");
const tabletStyles = tabletStylesStart < 0 || mobileStylesStart < 0 ? "" : sharedStyles.slice(tabletStylesStart, mobileStylesStart);
const mobileStyles = mobileStylesStart < 0 ? "" : sharedStyles.slice(mobileStylesStart);

for (const [styles, marker, label] of [
  [sharedStyles, ".hero-grid > * { min-width: 0; }", "direct hero-grid children must be shrinkable"],
  [tabletStyles, ".hero-grid { grid-template-columns: minmax(0, 1fr); gap: 2.2rem; padding-block: 3rem; }", "narrow hero-grid must use a zero-minimum track"],
  [mobileStyles, "h1 {\n    max-width: 100%;\n    font-size: clamp(2rem, 10vw, 3.4rem);\n    overflow-wrap: anywhere;\n  }", "narrow H1 typography must safely wrap long headings"]
]) {
  if (!styles.includes(marker)) errors.push(`site-src/styles.css: ${label}`);
}

if (!socialPreviewAsset || previewImagePath !== `/${socialPreviewAsset.path}` || previewImageUrl !== `https://fortmilo.co.uk/${socialPreviewAsset.path}`) {
  errors.push("social preview template path differs from the authoritative governed-asset manifest");
}
if (socialPreviewAsset?.dimensions?.width !== 1200 || socialPreviewAsset?.dimensions?.height !== 630) {
  errors.push("social preview manifest dimensions must be exactly 1200x630");
}

async function walk(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), relative));
    else files.push(relative);
  }
  return files;
}

function resolvePublicPath(value) {
  const clean = value.split("#", 1)[0].split("?", 1)[0];
  if (!clean || clean === "/") return "index.html";
  const relative = clean.startsWith("/") ? clean.slice(1) : clean;
  return relative.endsWith("/") ? `${relative}index.html` : relative;
}

function decodePdfString(value) {
  return value instanceof PDFString || value instanceof PDFHexString ? value.decodeText() : null;
}

const allFiles = await walk(root);
const fileSet = new Set(allFiles);
const publicDocumentCandidates = allFiles.filter((file) => file.startsWith("documents/") || !file.includes("/"));
for (const message of publicDocumentPathErrors(publicDocumentCandidates)) errors.push(message);

if (routes.length !== 14) errors.push(`expected 14 declared routes, found ${routes.length}`);

for (const route of routes) {
  const file = path.join(root, route.output);
  let html = "";
  try {
    html = await readFile(file, "utf8");
  } catch {
    errors.push(`${route.output}: missing route file`);
    continue;
  }

  if (!html.startsWith("<!doctype html>")) errors.push(`${route.output}: missing HTML5 doctype`);
  if (!html.includes('<html lang="en-GB">')) errors.push(`${route.output}: missing en-GB language`);
  if (!html.includes('<a class="skip-link" href="#main">Skip to content</a>')) errors.push(`${route.output}: missing skip link`);

  const sharedStylesheetReferences = [...html.matchAll(/<link rel="stylesheet" href="(\/assets\/site\.[a-f0-9]{12}\.css)">/gu)].map((match) => match[1]);
  if (sharedStylesheetReferences.length !== 1) {
    errors.push(`${route.output}: expected exactly one hashed shared stylesheet, found ${sharedStylesheetReferences.length}`);
  } else if (sharedStylesheetReferences[0] !== sharedStylesheetHref) {
    errors.push(`${route.output}: shared stylesheet is not current (expected ${sharedStylesheetHref})`);
  }

  if (route.noindex) {
    if (!html.includes('<meta name="robots" content="noindex">')) errors.push(`${route.output}: missing noindex`);
  }
  for (const message of canonicalMetadataErrors(html, route.canonical, { noindex: route.noindex })) errors.push(`${route.output}: ${message}`);

  for (const metadata of expectedSocialMetadata) {
    const count = html.split(metadata).length - 1;
    if (count !== 1) errors.push(`${route.output}: expected exactly one social metadata entry ${metadata}, found ${count}`);
  }
  for (const stalePath of staleGovernedAssetPaths) {
    if (html.includes(stalePath)) errors.push(`${route.output}: stale or deleted social/image path remains ${stalePath}`);
  }

  const footer = /<footer class="site-footer">[\s\S]*?<\/footer>/u.exec(html)?.[0] || "";
  for (const required of [
    'href="/contact.html">Contact</a>',
    'href="/acknowledgements.html">Acknowledgements</a>',
    'href="/privacy.html">Privacy</a>',
    'href="/terms.html">Terms</a>',
    'href="/documents/">Technical whitepaper</a>',
    'href="/.well-known/security.txt">Security</a>'
  ]) {
    if (!footer.includes(required)) errors.push(`${route.output}: footer missing ${required}`);
  }

  for (const message of headingErrors(html)) errors.push(`${route.output}: ${message}`);
  for (const message of namingErrors(html, route.output)) errors.push(`${route.output}: ${message}`);
  for (const message of evidenceTerminologyErrors(html)) errors.push(`${route.output}: ${message}`);
  for (const message of prohibitedPublicClaimErrors(html)) errors.push(`${route.output}: ${message}`);
  for (const message of issue32PositioningErrors(html, route.output)) errors.push(`${route.output}: ${message}`);
  for (const message of publicCopyRevisionErrors(html, currentPublicationDate)) errors.push(`${route.output}: ${message}`);
  for (const message of uniqueIdErrors(html)) errors.push(`${route.output}: ${message}`);
  for (const message of landmarkErrors(html)) errors.push(`${route.output}: ${message}`);
  for (const message of imageMarkupErrors(html)) errors.push(`${route.output}: ${message}`);
  for (const message of navigationStateErrors(html, route)) errors.push(`${route.output}: ${message}`);

  if (/<form\b/iu.test(html)) errors.push(`${route.output}: unexpected form`);
  if (/google-analytics|googletagmanager|segment\.com|mixpanel|hotjar/iu.test(html)) errors.push(`${route.output}: analytics/tracking reference found`);

  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/gu)) {
    const value = match[1];
    if (/^(?:https?:|mailto:|tel:|#|data:)/u.test(value)) continue;
    const target = resolvePublicPath(value);
    if (!fileSet.has(target)) errors.push(`${route.output}: broken internal reference ${value}`);
  }
}

const indexed = routes.filter((route) => !route.noindex);
if (indexed.some((route) => route.lastmod !== currentPublicationDate)) {
  errors.push(`site-map: every indexed route must have lastmod ${currentPublicationDate}`);
}

const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
if (sitemap.replace(/\r\n?/gu, "\n") !== renderSitemap()) errors.push("sitemap: bytes differ from authoritative route and publication-date metadata");
const sitemapLocations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/gu)].map((match) => match[1]);
if (sitemapLocations.length !== sitemapEntries.length || new Set(sitemapLocations).size !== sitemapLocations.length) {
  errors.push(`sitemap: expected ${sitemapEntries.length} exact unique locations, found ${sitemapLocations.length} entries and ${new Set(sitemapLocations).size} unique values`);
}
const expectedLastmod = `<lastmod>${currentPublicationDate}</lastmod>`;
const currentDocumentAssets = documentAssets.filter((asset) => asset.lastmod === currentPublicationDate);
if (sitemap.split(expectedLastmod).length - 1 !== indexed.length + currentDocumentAssets.length) {
  errors.push(`sitemap: expected ${indexed.length + currentDocumentAssets.length} lastmod values for ${currentPublicationDate}`);
}
for (const asset of documentAssets) {
  const entry = `<url><loc>${asset.canonical}</loc><lastmod>${asset.lastmod}</lastmod></url>`;
  if (!sitemap.includes(entry)) errors.push(`sitemap: missing document asset ${asset.canonical}`);
  if (!fileSet.has(asset.output)) errors.push(`site-map: missing document asset file ${asset.output}`);
}

const home = await readFile(path.join(root, "index.html"), "utf8");
if (!home.includes("Request access when available")) errors.push("index.html: missing access request CTA");
const overview = await readFile(path.join(root, "security-observatory/index.html"), "utf8");
for (const value of ["Five focused review areas", "Request access when available"]) {
  if (!overview.includes(value)) errors.push(`security-observatory/index.html: missing ${value}`);
}
const evidence = await readFile(path.join(root, "security-observatory/evidence.html"), "utf8");
for (const value of ["Evidence Terminology Contract", 'href="/EVIDENCE_TERMINOLOGY_CONTRACT.md"', "Licence-assignment capture status", "evidence detail level"]) {
  if (!evidence.includes(value)) errors.push(`security-observatory/evidence.html: missing ${value}`);
}
if (/evidence depth/iu.test(evidence)) errors.push("security-observatory/evidence.html: obsolete evidence depth wording remains");
const same20FamilyRule = "The same 20-family scanner plan runs at Top Issues, Balanced and Everything. The selected evidence detail level changes what safe detail is retained, displayed, compared and exported; it does not change which scanner families are planned. Everything is the deepest supported level, not exhaustive or unlimited.";
if (!evidence.includes(same20FamilyRule)) errors.push("security-observatory/evidence.html: missing same 20-family scanner-plan rule");
const coverageRule = "Coverage type describes how far available evidence can assess the mapped question. It is neither confidence nor the selected evidence detail level.";
if (!evidence.includes(coverageRule)) errors.push("security-observatory/evidence.html: missing Coverage-axis rule");
const coverageTileRule = "Coverage tiles, including Partial Evidence, remain separate from control-outcome tiles and filters.";
if (!evidence.includes(coverageTileRule)) errors.push("security-observatory/evidence.html: missing Coverage-tile separation rule");
const completenessRules = [
  "Not assessed: work not performed or outside assessed scope",
  "Unavailable: required attempted source inaccessible or unusable",
  "Not retained at this evidence level: detail intentionally not retained",
  "Not captured: product intentionally does not capture that detail",
  "Incomplete: separate licence-assignment capture status for bounded or truncated capture"
];
const findings = await readFile(path.join(root, "security-observatory/findings.html"), "utf8");
for (const [route, html] of [["security-observatory/evidence.html", evidence], ["security-observatory/findings.html", findings]]) {
  for (const value of completenessRules) {
    if (!html.includes(value)) errors.push(`${route}: missing completeness boundary ${value}`);
  }
}
const terminologyContract = await readFile(path.join(root, "EVIDENCE_TERMINOLOGY_CONTRACT.md"), "utf8");
for (const message of evidenceTerminologyErrors(terminologyContract)) errors.push(`EVIDENCE_TERMINOLOGY_CONTRACT.md: ${message}`);
for (const value of [
  "| **Not assessed** | The question was not assessed for the run or assessed scope. |",
  "**Incomplete** — the full licence-assignment population could not be retained safely. The captured count may be lower than expected or zero when safe Salesforce transaction/DML headroom is exhausted.",
  "Zero captured must not be inferred as zero assignments and must not be shown as Complete.",
  "When the expected count is unknown, the unknown expected count remains unknown.",
  "Incomplete remains a separate licence-assignment capture status, not a rendered evidence state.",
  coverageRule,
  "**Partial Evidence** is always Coverage, never an outcome or evidence state.",
  same20FamilyRule
]) {
  if (!terminologyContract.includes(value)) errors.push(`EVIDENCE_TERMINOLOGY_CONTRACT.md: missing ${value}`);
}
const stableContractPublicationRule = "A later approved terminology revision replaces this stable public file after the required conformity audit. Earlier text remains recoverable through Git history, while historical scan semantics retain their recorded terminology version. No parallel public versioned filename is created.";
if (!terminologyContract.includes(stableContractPublicationRule)) {
  errors.push("EVIDENCE_TERMINOLOGY_CONTRACT.md: stable publication rule is missing");
}
const architecture = await readFile(path.join(root, "architecture-security.html"), "utf8");
if (!architecture.includes("<strong>Read-only assessment</strong><span>No security remediation or write-back to assessed Salesforce configuration.</span>")) {
  errors.push("architecture-security.html: incorrect read-only assessment boundary");
}
const csvTrustBoundary = "Collection and retention occur inside the subscriber Salesforce organisation. The LWC prepares the allow-listed CSV in the authenticated browser session; downloading it creates a file outside Salesforce.";
if (!architecture.includes(csvTrustBoundary)) errors.push("architecture-security.html: incorrect CSV trust boundary");
const documents = await readFile(path.join(root, "documents/index.html"), "utf8");
if (documents.includes("Independent engineering research")) errors.push("documents/index.html: independent engineering research wording remains");
for (const value of [
  "Engineering methodology",
  "Fortmilo engineering-methodology publications",
  "Security Observatory is used as a bounded case study; no AI product capability is claimed for Security Observatory.",
  `<strong>Publication date</strong><span>${formatPublicationDate(publicationDates.methodologyPaper)}</span>`,
  'href="/documents/orchestrating-ai-for-secure-software-delivery.pdf">Read the accessible methodology paper</a>'
]) {
  if (!documents.includes(value)) errors.push(`documents/index.html: accessible methodology publication missing ${value}`);
}
if (/Security Observatory (?:has|includes|offers|uses) AI/iu.test(documents)) {
  errors.push("documents/index.html: Security Observatory is attributed an AI product capability");
}
if (!documents.includes('href="/documents/security-observatory-reference-architecture.svg">View the reference architecture</a>')) {
  errors.push("documents/index.html: stable reference architecture link is missing");
}
for (const value of [
  "<strong>Author</strong><span>Luca Pacini</span>",
  "<strong>Publisher</strong><span>Fortmilo</span>",
  `<strong>Last updated</strong><span>${formatPublicationDate(publicationDates.evidencePaper)}</span>`,
  'href="/documents/evidence-semantics-and-scanner-orchestration.pdf">Read the technical whitepaper</a>'
]) {
  if (!documents.includes(value)) errors.push(`documents/index.html: missing whitepaper publication field ${value}`);
}
for (const prohibited of ["v1.3", "v1.4", "v4.1", "v4.2", "immutable", "superseded", "historical version", "current stable PDF"]) {
  if (documents.toLowerCase().includes(prohibited.toLowerCase())) {
    errors.push(`documents/index.html: prohibited document-version language remains: ${prohibited}`);
  }
}

const currentWhitepaperPath = path.join(root, "documents", "evidence-semantics-and-scanner-orchestration.pdf");
const currentWhitepaper = await readFile(currentWhitepaperPath);
const whitepaper = await PDFDocument.load(currentWhitepaper, { updateMetadata: false });
if (whitepaper.getPageCount() !== 7) errors.push(`whitepaper: expected 7 pages, found ${whitepaper.getPageCount()}`);
for (const [label, actual, expected] of [
  ["title", whitepaper.getTitle(), "Evidence Semantics and Scanner Orchestration"],
  ["author", whitepaper.getAuthor(), "Luca Pacini"],
  ["subject", whitepaper.getSubject(), "Security Observatory evidence semantics, scanner planning and bounded licence-assignment retention"],
  ["creator", whitepaper.getCreator(), "Fortmilo document generation tooling"]
]) {
  if (actual !== expected) errors.push(`whitepaper: incorrect ${label} metadata`);
}
if (!whitepaper.getKeywords()?.includes("licence assignments")) errors.push("whitepaper: keywords metadata is incomplete");
const expectedWhitepaperDate = publicationDateAsUtc(publicationDates.evidencePaper).toISOString();
if (whitepaper.getCreationDate()?.toISOString() !== expectedWhitepaperDate) errors.push("whitepaper: creation date is not authoritative");
if (whitepaper.getModificationDate()?.toISOString() !== expectedWhitepaperDate) errors.push("whitepaper: modification date is not authoritative");
if (decodePdfString(whitepaper.catalog.get(PDFName.of("Lang"))) !== "en-GB") errors.push("whitepaper: catalog language is not en-GB");
if (!whitepaper.catalog.get(PDFName.of("StructTreeRoot"))) errors.push("whitepaper: structure tree is missing");
const markInfo = whitepaper.catalog.lookupMaybe(PDFName.of("MarkInfo"), PDFDict);
if (markInfo?.get(PDFName.of("Marked"))?.toString() !== "true") errors.push("whitepaper: MarkInfo does not declare marked content");
const outlineRoot = whitepaper.catalog.lookupMaybe(PDFName.of("Outlines"), PDFDict);
if (!outlineRoot) errors.push("whitepaper: bookmarks are missing");

const bookmarkTitles = [];
function collectBookmarks(first, depth = 0) {
  let bookmark = first;
  let siblingCount = 0;
  while (bookmark && siblingCount < 100 && depth < 8) {
    bookmarkTitles.push(decodePdfString(bookmark.get(PDFName.of("Title"))));
    const child = bookmark.lookupMaybe(PDFName.of("First"), PDFDict);
    if (child) collectBookmarks(child, depth + 1);
    bookmark = bookmark.lookupMaybe(PDFName.of("Next"), PDFDict);
    siblingCount += 1;
  }
}
collectBookmarks(outlineRoot?.lookupMaybe(PDFName.of("First"), PDFDict));
for (const title of [
  "Evidence Semantics and Scanner Orchestration",
  "Abstract",
  "1. Claim scope and evidence boundary",
  "2. The terminology contract",
  "3. One scanner plan, three detail levels",
  "4. Licence-assignment retention contract",
  "5. Capture status and count presentation",
  "6. Orchestration and failure semantics",
  "7. Comparison and export boundaries",
  "8. Current validation and publication limitations",
  "9. Conclusion",
  "References and maintained boundaries",
  "Publication and licensing"
]) {
  if (!bookmarkTitles.includes(title)) errors.push(`whitepaper: bookmark is missing ${title}`);
}

const structureRoles = new Map();
const figureAlternatives = [];
const embeddedFonts = [];
for (const [, object] of whitepaper.context.enumerateIndirectObjects()) {
  if (!(object instanceof PDFDict)) continue;
  const role = object.get(PDFName.of("S"))?.toString();
  if (role) structureRoles.set(role, (structureRoles.get(role) || 0) + 1);
  if (role === "/Figure") figureAlternatives.push(decodePdfString(object.get(PDFName.of("Alt"))));
  if (object.get(PDFName.of("Type"))?.toString() !== "/Font") continue;
  const descriptor = object.lookupMaybe(PDFName.of("FontDescriptor"), PDFDict);
  if (descriptor) {
    embeddedFonts.push(Boolean(descriptor.get(PDFName.of("FontFile2")) || descriptor.get(PDFName.of("FontFile3"))));
  }
}
for (const role of ["/Document", "/H1", "/H2", "/H3", "/Table", "/TR", "/TH", "/TD", "/L", "/LI", "/Figure", "/Link"]) {
  if (!structureRoles.get(role)) errors.push(`whitepaper: semantic structure role ${role} is missing`);
}
if (figureAlternatives.length !== 1 || !figureAlternatives[0]?.includes("20-family scanner plan")) {
  errors.push("whitepaper: figure alternative text is missing or incorrect");
}
if (!embeddedFonts.length || embeddedFonts.some((embedded) => !embedded)) errors.push("whitepaper: one or more descriptor fonts are not embedded");

const linkUris = [];
let structuredLinkCount = 0;
for (const [pageIndex, page] of whitepaper.getPages().entries()) {
  if (page.node.get(PDFName.of("Tabs"))?.toString() !== "/S") {
    errors.push(`whitepaper: page ${pageIndex + 1} does not use structure order for keyboard navigation`);
  }
  const annotations = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
  if (!annotations) continue;
  for (let index = 0; index < annotations.size(); index += 1) {
    const annotation = annotations.lookup(index, PDFDict);
    if (annotation.get(PDFName.of("Subtype"))?.toString() !== "/Link") continue;
    const action = annotation.lookupMaybe(PDFName.of("A"), PDFDict);
    const uri = decodePdfString(action?.get(PDFName.of("URI")));
    if (uri) {
      linkUris.push(uri);
      if (annotation.get(PDFName.of("StructParent")) instanceof PDFNumber) structuredLinkCount += 1;
    }
    const rectangle = annotation.lookupMaybe(PDFName.of("Rect"), PDFArray);
    if (!rectangle || rectangle.size() !== 4) errors.push(`whitepaper: page ${pageIndex + 1} has a link without a valid rectangle`);
  }
}
if (structuredLinkCount !== linkUris.length) errors.push(`whitepaper: ${linkUris.length - structuredLinkCount} URI links are not associated with tagged structure`);
for (const message of publicDocumentPathErrors(linkUris)) errors.push(`whitepaper URI: ${message}`);
for (const uri of [
  "https://fortmilo.co.uk/EVIDENCE_TERMINOLOGY_CONTRACT.md",
  "https://fortmilo.co.uk/security-observatory/",
  "https://fortmilo.co.uk/documents/security-observatory-reference-architecture.svg",
  "https://creativecommons.org/licenses/by/4.0/"
]) {
  if (!linkUris.includes(uri)) errors.push(`whitepaper: hyperlink annotation missing ${uri}`);
}

const whitepaperSource = await readFile(path.join(root, "document-src", "evidence-semantics-and-scanner-orchestration.html"), "utf8");
for (const message of headingErrors(whitepaperSource)) errors.push(`whitepaper source: ${message}`);
for (const claim of [
  "The same 20-family scanner plan runs at Top Issues, Balanced and Everything.",
  "Package Licences",
  "Permission Set Licences",
  "Salesforce User Licences",
  "The retained-row maximum remains 1,000 per family, never 1,001.",
  "The theoretical maximum across all three families is therefore <strong>3,000 retained assignment rows per scan</strong>.",
  "Zero captured is never enough to claim zero assignments.",
  "When expected is unknown, leave it unknown.",
  "sandbox-first",
  "not yet available for public installation",
  "Managed 2GP package creation, installation, upgrade and subscriber-org behaviour are not proved",
  "Source review and document generation are not runtime proof."
]) {
  if (!whitepaperSource.includes(claim)) errors.push(`whitepaper source: missing material claim ${claim}`);
}
if (whitepaperSource.includes("The front-matter fields are reference data")) errors.push("whitepaper source: drafting note remains");
const whitepaperGenerator = await readFile(path.join(root, "scripts", "generate-evidence-paper.mjs"), "utf8");
if (!whitepaperGenerator.includes('const output = join(root, "documents", "evidence-semantics-and-scanner-orchestration.pdf")')) {
  errors.push("whitepaper generator does not target the one stable public PDF path");
}
if (/copyFile|immutable|evidence-semantics-and-scanner-orchestration-v\d/iu.test(whitepaperGenerator)) {
  errors.push("whitepaper generator creates or copies a parallel public edition");
}

const referenceSvg = await readFile(path.join(root, "documents/security-observatory-reference-architecture.svg"), "utf8");
for (const message of uniqueIdErrors(referenceSvg)) errors.push(`reference architecture: ${message}`);
for (const message of standaloneSvgAccessibilityErrors(referenceSvg)) errors.push(`reference architecture: ${message}`);
if (!referenceSvg.includes(`LAST UPDATED · ${formatPublicationDate(publicationDates.referenceArchitecture, { uppercase: true, month: "short" })}`)) {
  errors.push("reference architecture: visible last-updated date differs from publication-date authority");
}
if (!referenceSvg.includes('<title id="soTitle">Security Observatory — reference architecture</title>')) {
  errors.push("reference architecture: accessible title is not canonical");
}
if (referenceSvg.includes("Security Observatory by Fortmilo")) {
  errors.push("reference architecture: routine compound title remains");
}
for (const message of namingErrors(referenceSvg, "documents/security-observatory-reference-architecture.svg")) {
  errors.push(`reference architecture: ${message}`);
}
for (const message of evidenceTerminologyErrors(referenceSvg)) {
  errors.push(`reference architecture: ${message}`);
}

function xmlText(value) {
  return value
    .replace(/<[^>]+>/gu, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replace(/\s+/gu, " ")
    .trim();
}

const descMatch = /<desc\b[^>]*>([\s\S]*?)<\/desc>/u.exec(referenceSvg);
const visibleReferenceText = [...referenceSvg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gu)]
  .map((match) => xmlText(match[1]))
  .join(" ")
  .replace(/\s+/gu, " ")
  .trim();
const accessibleReferenceText = descMatch ? xmlText(descMatch[1]) : "";
if (!descMatch) errors.push("reference architecture: accessible description is missing");

const materialReferenceClaims = [
  "No automated evidence transmission to Fortmilo or third-party services.",
  "No security remediation or write-back to assessed Salesforce configuration.",
  "Server-side collection and retention occur in the subscriber Salesforce organisation.",
  "LWC JavaScript prepares the allow-listed CSV in the authenticated browser session.",
  "Downloading creates a local file outside Salesforce.",
  "The customer controls storage, sharing and onward handling.",
  "No persisted Salesforce CSV artefact is asserted.",
  "Raw IP values are omitted or redacted; exact retained-data and export shape remains subject to validation per environment and reviewed path.",
  "Contextual metric or finding label",
  "None found",
  "Unavailable",
  "Not assessed",
  "Not retained at this evidence level",
  "Not captured",
  "Not applicable",
  "The contextual label is bounded by the retained usable evidence.",
  "These are evidence states, not compliance or pass/fail decisions.",
  "Partial is a completeness qualifier, not a rendered evidence state.",
  "Licence-assignment capture status",
  "Incomplete is not a rendered evidence state.",
  "Coverage varies by release.",
  "Salesforce package architecture; delivery and validated coverage remain release-specific.",
  "Any remediation decision and action remains with the owner.",
  "Fortmilo operates no hosted evidence service or automated telemetry ingestion.",
  "Reference architecture only; managed 2GP installation proof and public availability are not asserted."
];
for (const claim of materialReferenceClaims) {
  if (!visibleReferenceText.includes(claim)) errors.push(`reference architecture: visible text missing material claim ${claim}`);
  if (!accessibleReferenceText.includes(claim)) errors.push(`reference architecture: <desc> missing material claim ${claim}`);
}
if (visibleReferenceText.includes("1,000") || accessibleReferenceText.includes("1,000")) {
  errors.push("reference architecture: numeric licence-assignment limit should remain in maintained Product boundaries");
}
for (const match of referenceSvg.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gu)) {
  const value = match[1];
  if (/^(?:https?:|mailto:|tel:|#|data:)/u.test(value)) continue;
  const target = resolvePublicPath(value);
  if (!fileSet.has(target)) errors.push(`reference architecture: broken internal reference ${value}`);
}
if (!referenceSvg.includes('href="/security-observatory/"')) {
  errors.push("reference architecture: maintained Product boundaries link is missing");
}
if (!referenceSvg.includes('href="/EVIDENCE_TERMINOLOGY_CONTRACT.md"')) {
  errors.push("reference architecture: stable terminology-contract link is missing");
}
for (const prohibited of ["v4.1", "v4.2", "historical architecture"]) {
  if (referenceSvg.toLowerCase().includes(prohibited)) {
    errors.push(`reference architecture: prohibited version-selection language remains: ${prohibited}`);
  }
}

for (const image of allFiles.filter((file) => /\.(?:png|jpe?g|ico|svg)$/iu.test(file))) {
  if ((await stat(path.join(root, image))).size === 0) errors.push(`${image}: empty image asset`);
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`Validated ${routes.length} routes, ${indexed.length} indexed pages, ${documentAssets.length} document URLs, links, evidence PDF (${whitepaper.getPageCount()} pages, ${bookmarkTitles.length} bookmarks, ${linkUris.length} URI links, ${embeddedFonts.length} embedded font descriptors) and reference architecture`);
