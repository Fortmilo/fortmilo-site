import { createHash } from "node:crypto";
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
import { publicDocumentPathErrors } from "./public-site-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pdfPath = path.join(root, "documents", "orchestrating-ai-for-secure-software-delivery.pdf");
const sourcePath = path.join(root, "document-src", "orchestrating-ai-for-secure-software-delivery.html");
const originalTextPath = path.join(root, "document-src", "orchestrating-ai-for-secure-software-delivery.original.txt");
const generatorPath = path.join(root, "scripts", "generate-ai-methodology-paper.mjs");
const originalPdfBaseCommit = "eef726558763129453cada2b184dda527f289d2a";
const expectedOriginalTextSha256 = "ba9b4457f916a92b57555d157811950913867f3e0c81d1bab0cf789b21a17751";
const errors = [];
for (const message of publicDocumentPathErrors(["documents/orchestrating-ai-for-secure-software-delivery.pdf"])) {
  errors.push(`methodology publication path: ${message}`);
}

function visibleHtmlText(value) {
  return value
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">");
}

function whitespaceWordCount(value) {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function normalisedTokens(value) {
  return value
    .normalize("NFKC")
    .replace(/FortMilo/giu, "Fortmilo")
    .trim()
    .split(/\s+/u)
    .map((token) => token.toLocaleLowerCase("en-GB").replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter((token) => token && token !== "cid127");
}

function longestCommonSubsequenceLength(originalTokens, replacementTokens) {
  const originalLength = originalTokens.length;
  const replacementLength = replacementTokens.length;
  const maximumDistance = originalLength + replacementLength;
  let frontier = new Map([[1, 0]]);

  for (let distance = 0; distance <= maximumDistance; distance += 1) {
    const next = new Map();
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      const down = frontier.get(diagonal + 1);
      const right = frontier.get(diagonal - 1);
      let x;
      if (diagonal === -distance || (diagonal !== distance && (right ?? -1) < (down ?? -1))) {
        x = down ?? 0;
      } else {
        x = (right ?? -1) + 1;
      }
      let y = x - diagonal;
      while (x < originalLength && y < replacementLength && originalTokens[x] === replacementTokens[y]) {
        x += 1;
        y += 1;
      }
      next.set(diagonal, x);
      if (x >= originalLength && y >= replacementLength) {
        return (originalLength + replacementLength - distance) / 2;
      }
    }
    frontier = next;
  }
  return 0;
}

function plainHeadingText(value) {
  return value.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim();
}

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

const [pdfBytes, source, originalTextWithPlatformEndings, generator] = await Promise.all([
  readFile(pdfPath),
  readFile(sourcePath, "utf8"),
  readFile(originalTextPath, "utf8"),
  readFile(generatorPath, "utf8"),
]);
const originalText = originalTextWithPlatformEndings.replace(/\r\n?/gu, "\n");

const originalWordCount = whitespaceWordCount(originalText);
const replacementVisibleText = visibleHtmlText(source);
const normalisedVisibleText = replacementVisibleText.replace(/\s+/gu, " ").trim();
const replacementWordCount = whitespaceWordCount(replacementVisibleText);
const originalTokens = normalisedTokens(originalText);
const replacementTokens = normalisedTokens(replacementVisibleText);
const retainedTokenCount = longestCommonSubsequenceLength(originalTokens, replacementTokens);
const retentionPercentage = retainedTokenCount / originalTokens.length * 100;
const originalTextSha256 = createHash("sha256").update(originalText, "utf8").digest("hex");
if (originalTextSha256 !== expectedOriginalTextSha256) {
  errors.push(`base-PDF text baseline for ${originalPdfBaseCommit} has an unexpected SHA-256 digest`);
}
if (originalWordCount !== 11970) errors.push(`base-PDF text baseline contains ${originalWordCount} words, expected 11970`);
if (replacementWordCount < originalWordCount * 0.95) {
  errors.push(`semantic source contains ${replacementWordCount} words, below 95% of the ${originalWordCount}-word base PDF`);
}
if (retentionPercentage < 95) {
  errors.push(`normalised ordered text retention is ${retentionPercentage.toFixed(2)}%, below 95%`);
}

const sourceHeadings = new Set(
  [...source.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/giu)].map((match) => plainHeadingText(match[1])),
);
const requiredHeadings = [
  "Orchestrating AI for Secure Software Delivery",
  "Contents",
  "Abstract",
  "1. Introduction",
  "1.1 The capacity problem in small software projects",
  "1.2 The failure of informal AI assistance",
  "1.3 Purpose and contribution",
  "2. Scope, definitions and methodological stance",
  "2.1 Scope",
  "2.2 Definitions",
  "2.3 Methodological stance",
  "3. Risk model for AI-assisted delivery",
  "3.1 Risk is introduced at the interaction boundary",
  "3.2 Principal failure modes",
  "Requirement invention",
  "Scope laundering",
  "False completion",
  "Evidence inflation",
  "Review correlation",
  "Self-review limitation",
  "Security weakness propagation",
  "Sensitive-data disclosure",
  "Context collision and operator fatigue",
  "Automation bias",
  "3.3 Risk is not reduced by model plurality alone",
  "4. Governance principles",
  "4.1 Human-owned intent",
  "4.2 Bounded authority",
  "4.3 Source hierarchy",
  "4.4 Evidence before acceptance",
  "4.5 Role separation",
  "4.6 Data minimisation",
  "4.7 Traceable state transitions",
  "4.8 Reproducibility",
  "4.9 Consensus is not proof",
  "4.10 Public claims are release artefacts",
  "4.11 Operator state is part of the control boundary",
  "5. The evidence-gated delivery cycle",
  "5.1 Human-owned intent and constraints",
  "5.2 Bounded issue contract",
  "5.3 AI-assisted implementation",
  "5.4 Automated proof",
  "5.5 Role-separated adversarial challenge",
  "5.6 Human adjudication",
  "5.7 Release gate",
  "5.8 Live verification",
  "5.9 Governance close-out",
  "6. Roles and separation of responsibility",
  "6.1 Owner, architect and release authority",
  "6.2 Orchestration, synthesis and research role",
  "6.3 Implementation role",
  "6.4 Role-separated adversarial-challenge role",
  "6.5 Automated evidence role",
  "6.6 External-source and live-boundary verification",
  "6.7 Role allocation is replaceable; authority rules are not",
  "7. The task contract",
  "7.1 Required elements",
  "7.2 Why exclusions matter",
  "7.3 Stop conditions as controls",
  "8. Evidence classes and permitted claims",
  "8.1 Evidence is a ladder, not a binary label",
  "8.2 Evidence cannot be silently promoted",
  "8.3 Claim classes are not product vocabulary",
  "9. Security and data boundaries",
  "9.1 Least information to the model",
  "9.2 Repository and context boundaries",
  "9.3 No autonomous remediation",
  "9.4 Prompt and transcript retention",
  "9.5 External research and live-web boundary",
  "10. Role-separated adversarial challenge and human adjudication",
  "10.1 Challenger objective",
  "10.2 Challenge without scope capture",
  "10.3 Model/provider separation is not third-party assurance",
  "10.4 Resolving model disagreement",
  "10.5 Human visual and professional judgement",
  "11. Case study: Security Observatory",
  "11.1 Project context",
  "11.2 Actual tool and authority allocation",
  "11.3 Requirements and governance as the control plane",
  "11.4 Multi-repository and multi-worktree orchestration",
  "11.5 Salesforce product delivery path",
  "11.6 Public website and publication delivery path",
  "11.7 Web research and external-source verification",
  "11.8 Complete trace: evidence-first website release",
  "11.9 Non-confirming product cases: evidence failures found by challenge",
  "11.10 Publication-process failures and hardening",
  "11.11 Human factors: too many windows, one tired operator",
  "11.12 Human-only decisions",
  "11.13 Context deliberately withheld from AI systems",
  "11.14 What the case study does not prove",
  "12. Measuring value without productivity theatre",
  "12.1 Productivity evidence is context-dependent",
  "12.2 Recommended measures",
  "12.3 Quality-adjusted capacity",
  "13. Anti-patterns",
  "13.1 The giant prompt",
  "13.2 The self-certifying agent",
  "13.3 Model voting",
  "13.4 Test-green absolutism",
  "13.5 Validator weakening",
  "13.6 Unbounded tidy-up",
  "13.7 Secret-rich context",
  "13.8 Publication before evidence",
  "13.9 Artificial freshness",
  "13.10 Endless review churn",
  "13.11 The six-window cockpit",
  "14. Proportionate adoption for a small project",
  "14.1 Minimum viable control set",
  "14.2 Risk-based tailoring",
  "14.3 When the method should become heavier",
  "15. Relationship to established guidance",
  "15.1 What the cited instruments govern",
  "15.2 Adjacent bodies of practice",
  "15.3 The gap this method occupies",
  "16. Limitations and research agenda",
  "16.1 Single-project derivation",
  "16.2 The assessor is not independent",
  "16.3 No controlled productivity comparison",
  "16.4 Model and tool evolution",
  "16.5 Human oversight is itself fallible",
  "16.6 Private evidence",
  "16.7 Future research",
  "17. Practical adoption checklist",
  "Before the task",
  "During implementation",
  "Before release",
  "After release",
  "18. Conclusion",
  "Appendix A. Reusable bounded task contract",
  "Requirement anchor",
  "Repository and baseline",
  "Objective",
  "In scope",
  "Out of scope",
  "Security and data boundaries",
  "Validation",
  "Stop conditions",
  "Commit and publication",
  "Final report",
  "Appendix B. Minimal delivery evidence register",
  "References",
  "Publication and licensing",
];
for (const heading of requiredHeadings) {
  if (!sourceHeadings.has(heading)) errors.push(`semantic source is missing original heading ${heading}`);
}

for (const caption of [
  "Terms used in this publication",
  "Required task-contract elements",
  "Evidence classes and permitted claims",
  "Case-study role allocation and authority boundaries",
  "Evidence domains and their limits",
  "Publication-process failures and strengthened controls",
  "Proposed measurement instrumentation; no values are reported",
]) {
  if (!normalisedVisibleText.includes(caption)) errors.push(`semantic source is missing original table ${caption}`);
}
for (const rowLabel of [
  "Governance close-out",
  "No conclusion available",
  "External/live evidence",
  "Human adjudication",
  "I found that publication wording no longer matched",
  "Live verification failures",
]) {
  if (!replacementVisibleText.includes(rowLabel)) errors.push(`semantic source is missing original table row ${rowLabel}`);
}
const listItemCount = (source.match(/<li\b/giu) || []).length;
if (listItemCount < 170) errors.push(`expected all original lists and references, found only ${listItemCount} list items`);
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

if (!source.includes('<html lang="en-GB">')) errors.push("semantic source language is not en-GB");
if (!source.includes('scope="col"') || !source.includes('scope="row"')) errors.push("semantic tables do not declare column and row header scope");
for (const value of [
  "Orchestrating AI for Secure Software Delivery",
  "Author Luca Pacini",
  "Publisher Fortmilo",
  "Version 1.0 accessible edition",
  "Status Current",
  "Original publication date 11 August 2026",
  "Accessible edition date 30 August 2026",
  "this publication makes no claim that Security Observatory contains, offers or depends on AI product capabilities",
]) {
  if (!normalisedVisibleText.includes(value)) errors.push(`semantic source is missing ${value}`);
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

console.log(`Validated accessible AI methodology PDF: ${publication.getPageCount()} pages, ${bookmarkCount} bookmarks, ${linkUris.length} URI links, ${figureAlternatives.length} figure alternatives and ${fontDescriptors.length} embedded font descriptors; source retains ${retentionPercentage.toFixed(2)}% of ${originalWordCount} base-PDF words in normalised order (${replacementWordCount} replacement words)`);
