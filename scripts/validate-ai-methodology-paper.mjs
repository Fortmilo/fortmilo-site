import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFString,
} from "pdf-lib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pdfPath = path.join(root, "documents", "orchestrating-ai-for-secure-software-delivery.pdf");
const sourcePath = path.join(root, "document-src", "orchestrating-ai-for-secure-software-delivery.html");
const generatorPath = path.join(root, "scripts", "generate-ai-methodology-paper.mjs");
const errors = [];

function decodePdfString(value) {
  return value instanceof PDFString || value instanceof PDFHexString ? value.decodeText() : null;
}

function dictionaryValue(dictionary, key) {
  return decodePdfString(dictionary?.get(PDFName.of(key)));
}

const documentFiles = (await readdir(path.join(root, "documents")))
  .filter((name) => /^orchestrating-ai-for-secure-software-delivery.*\.pdf$/u.test(name));
if (documentFiles.length !== 1 || documentFiles[0] !== "orchestrating-ai-for-secure-software-delivery.pdf") {
  errors.push(`expected only the stable methodology PDF path, found ${documentFiles.join(", ") || "none"}`);
}

const [pdfBytes, source, generator] = await Promise.all([
  readFile(pdfPath),
  readFile(sourcePath, "utf8"),
  readFile(generatorPath, "utf8"),
]);
const publication = await PDFDocument.load(pdfBytes, { updateMetadata: false });
const catalog = publication.catalog;
const context = publication.context;

for (const [label, actual, expected] of [
  ["title", publication.getTitle(), "Orchestrating AI for Secure Software Delivery"],
  ["author", publication.getAuthor(), "Luca Pacini"],
  ["creator", publication.getCreator(), "Fortmilo document generation tooling"],
]) {
  if (actual !== expected) errors.push(`metadata ${label} is ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}
if (!publication.getSubject()?.startsWith("Fortmilo engineering methodology")) {
  errors.push("metadata subject does not identify the Fortmilo engineering methodology");
}
if (publication.getKeywords()?.includes("FortMilo")) errors.push("metadata keywords retain prohibited FortMilo casing");
if (publication.getCreationDate()?.toISOString() !== "2026-08-30T00:00:00.000Z") errors.push("creation date is not the publication date");
if (publication.getModificationDate()?.toISOString() !== "2026-08-30T00:00:00.000Z") errors.push("modification date is not the publication date");

const infoReference = context.trailerInfo.Info;
const info = infoReference ? context.lookup(infoReference, PDFDict) : null;
for (const [key, expected] of [
  ["Publisher", "Fortmilo"],
  ["Version", "1.0 accessible edition"],
  ["Status", "Current"],
]) {
  if (dictionaryValue(info, key) !== expected) errors.push(`internal ${key} metadata is not ${expected}`);
}

if (decodePdfString(catalog.get(PDFName.of("Lang"))) !== "en-GB") errors.push("catalog language is not en-GB");
if (!catalog.get(PDFName.of("StructTreeRoot"))) errors.push("structure tree is missing");
const markInfo = catalog.lookupMaybe(PDFName.of("MarkInfo"), PDFDict);
if (markInfo?.get(PDFName.of("Marked"))?.toString() !== "true") errors.push("MarkInfo does not declare marked content");
if (catalog.get(PDFName.of("PageMode"))?.toString() !== "/UseOutlines") errors.push("document does not open with bookmarks available");
const viewerPreferences = catalog.lookupMaybe(PDFName.of("ViewerPreferences"), PDFDict);
if (viewerPreferences?.get(PDFName.of("DisplayDocTitle"))?.toString() !== "true") errors.push("viewer preferences do not display the document title");
if (!(catalog.lookupMaybe(PDFName.of("Metadata"), PDFRawStream))) errors.push("XMP metadata stream is missing");

const roleCounts = new Map();
const figureAlternatives = [];
const fontDescriptors = [];
for (const [, object] of context.enumerateIndirectObjects()) {
  if (!(object instanceof PDFDict)) continue;
  const role = object.get(PDFName.of("S"))?.toString();
  if (role) roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
  if (role === "/Figure") figureAlternatives.push(decodePdfString(object.get(PDFName.of("Alt"))));
  if (object.get(PDFName.of("Type"))?.toString() === "/FontDescriptor") fontDescriptors.push(object);
}

for (const role of ["/H1", "/H2", "/H3", "/L", "/LI", "/Table", "/TR", "/TH", "/TD", "/Figure", "/Link"]) {
  if (!roleCounts.get(role)) errors.push(`tagged structure is missing ${role}`);
}
if (roleCounts.get("/H1") !== 1) errors.push(`expected one H1 structure element, found ${roleCounts.get("/H1") || 0}`);
if (figureAlternatives.length !== 3) errors.push(`expected three tagged figures, found ${figureAlternatives.length}`);
if (figureAlternatives.some((value) => !value || value.trim().length < 40)) errors.push("every tagged figure must have meaningful alternative text");
if (!fontDescriptors.length) errors.push("no font descriptors found");
for (const descriptor of fontDescriptors) {
  if (!descriptor.get(PDFName.of("FontFile")) && !descriptor.get(PDFName.of("FontFile2")) && !descriptor.get(PDFName.of("FontFile3"))) {
    errors.push("a font descriptor does not contain an embedded font program");
  }
}

const outlines = catalog.lookupMaybe(PDFName.of("Outlines"), PDFDict);
const bookmarkTitles = [];
function collectBookmarks(first, depth = 0) {
  let bookmark = first;
  let siblingCount = 0;
  while (bookmark && siblingCount < 200 && depth < 8) {
    bookmarkTitles.push(decodePdfString(bookmark.get(PDFName.of("Title"))));
    const child = bookmark.lookupMaybe(PDFName.of("First"), PDFDict);
    if (child) collectBookmarks(child, depth + 1);
    bookmark = bookmark.lookupMaybe(PDFName.of("Next"), PDFDict);
    siblingCount += 1;
  }
}
collectBookmarks(outlines?.lookupMaybe(PDFName.of("First"), PDFDict));
const bookmarkCount = bookmarkTitles.length;
if (bookmarkCount < 20) errors.push(`expected at least 20 bookmarks, found ${bookmarkCount}`);
for (const title of ["Orchestrating AI for Secure Software Delivery", "1. Introduction", "11. Case study: Security Observatory", "References", "Publication and licensing"]) {
  if (!bookmarkTitles.includes(title)) errors.push(`bookmark is missing ${title}`);
}

const linkUris = [];
let structuredLinkCount = 0;
for (const [pageIndex, page] of publication.getPages().entries()) {
  if (page.node.get(PDFName.of("Tabs"))?.toString() !== "/S") errors.push(`page ${pageIndex + 1} does not use structure order for keyboard navigation`);
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
    if (!rectangle || rectangle.size() !== 4) errors.push(`page ${pageIndex + 1} has a link without a valid rectangle`);
  }
}
if (linkUris.length < 25) errors.push(`expected at least 25 URI link annotations, found ${linkUris.length}`);
if (structuredLinkCount !== linkUris.length) errors.push(`${linkUris.length - structuredLinkCount} URI links are not associated with tagged structure`);
for (const uri of [
  "https://fortmilo.co.uk/documents/orchestrating-ai-for-secure-software-delivery.pdf",
  "https://fortmilo.co.uk/documents/evidence-semantics-and-scanner-orchestration.pdf",
  "https://creativecommons.org/licenses/by/4.0/",
]) {
  if (!linkUris.includes(uri)) errors.push(`required URI link annotation is missing ${uri}`);
}

for (const value of [
  '<html lang="en-GB">',
  "<h1 id=\"document-title\">Orchestrating AI for Secure Software Delivery</h1>",
  "<th scope=\"col\">Field</th>",
  "<th scope=\"row\">Author</th>",
  "Version 1.0 accessible edition - Current",
  "<tr><th scope=\"row\">Publisher</th><td>Fortmilo</td></tr>",
  "<tr><th scope=\"row\">Version</th><td>1.0 accessible edition</td></tr>",
  "<tr><th scope=\"row\">Status</th><td>Current</td></tr>",
  "<tr><th scope=\"row\">Publication date</th><td>30 August 2026</td></tr>",
  "this publication makes no claim that Security Observatory contains, offers or depends on AI product capabilities",
]) {
  if (!source.includes(value)) errors.push(`semantic source is missing ${value}`);
}
if (source.includes("FortMilo")) errors.push("semantic source retains prohibited FortMilo casing");
if (!generator.includes('const output = join(root, "documents", "orchestrating-ai-for-secure-software-delivery.pdf")')) {
  errors.push("generator does not target the one stable public PDF path");
}
if (/orchestrating-ai-for-secure-software-delivery-v[^"']*\.pdf/u.test(generator)) {
  errors.push("generator contains a versioned public PDF path");
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`Validated accessible AI methodology PDF: ${publication.getPageCount()} pages, ${bookmarkCount} bookmarks, ${linkUris.length} URI links, ${figureAlternatives.length} figure alternatives and ${fontDescriptors.length} embedded font descriptors`);
