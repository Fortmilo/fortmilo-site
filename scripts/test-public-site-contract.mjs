import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publicationDates } from "../site-src/publication-metadata.mjs";
import { navigationStateErrors, replaceExactly } from "./build-contract.mjs";
import { governedAssetErrors, governedAssets } from "./governed-assets.mjs";
import {
  canonicalMetadataErrors,
  customerVisibleSurface,
  evidenceTerminologyErrors,
  headingErrors,
  imageMarkupErrors,
  landmarkErrors,
  namingErrors,
  prohibitedEvidenceClaims,
  prohibitedPublicClaimErrors,
  publicCopyRevisionErrors,
  publicDocumentPathErrors,
  uniqueIdErrors
} from "./public-site-contract.mjs";
import { publicationReferenceErrors } from "./publication-references.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

assert.deepEqual(headingErrors("<h1>One</h1><h2>Two</h2><h3>Three</h3>"), []);
assert.ok(headingErrors("<h1>One</h1><h3>Three</h3>").some((value) => value.includes("skipped H1 to H3")));
assert.ok(headingErrors("<h1>One</h1><h1>Again</h1>").some((value) => value.includes("exactly one H1")));
assert.ok(headingErrors("<h2>Two</h2><h1>One</h1>").some((value) => value.includes("H1 must be first")));

for (const html of [
  "<p>Salesforce Security Observatory</p>",
  '<meta name="description" content="FortMilo">',
  '<meta property="og:title" content="FORTMILO">',
  '<meta name="twitter:image:alt" content="Fortmilo Security Observatory">',
  '<img alt="Salesforce Security Observatory" src="/safe.png">',
  '<script type="application/ld+json">{"name":"Salesforce Security Observatory"}</script>'
]) assert.ok(namingErrors(html, "test.html").length > 0, `expected naming failure for ${html}`);

for (const html of [
  "<p>Fortmilo</p>",
  '<nav aria-label="Security Observatory by Fortmilo"></nav>',
  '<img src="/assets/fortmilo-security-observatory-og-20260731.jpg" alt="Fortmilo — Security Observatory">'
]) assert.deepEqual(namingErrors(html, "test.html"), []);

const surface = customerVisibleSurface('<meta name="description" content="Safe description"><img src="unsafe-name.jpg" alt="Safe alt">');
assert.ok(surface.includes("Safe description"));
assert.ok(surface.includes("Safe alt"));
assert.ok(!surface.includes("unsafe-name.jpg"));

for (const claim of prohibitedEvidenceClaims) {
  assert.ok(evidenceTerminologyErrors(`<p>${claim}</p>`).length > 0, `expected evidence-semantics failure for ${claim}`);
}
assert.deepEqual(evidenceTerminologyErrors(`
  <p>Not assessed means work was not performed or the question was outside the assessed scope.</p>
  <p>Not retained at this evidence level and Not captured identify intentional detail omissions.</p>
  <p>Coverage type describes how far available evidence can assess the mapped question. It is neither confidence nor the selected evidence detail level.</p>
  <p>Coverage tiles, including Partial Evidence, remain separate from control-outcome tiles and filters.</p>
  <p>Collection and retention occur inside the subscriber Salesforce organisation. The LWC prepares the allow-listed CSV in the authenticated browser session; downloading it creates a file outside Salesforce.</p>
`), []);

const currentPublicationDate = publicationDates.site;
assert.deepEqual(publicCopyRevisionErrors(`<main data-public-copy-revision="${currentPublicationDate}"></main>`, currentPublicationDate), []);
assert.ok(publicCopyRevisionErrors('<main data-public-copy-revision="2026-08-19"></main>', currentPublicationDate).some((value) => value.includes("does not match current publication date")));

for (const rejectedPath of [
  "documents/report-v1.pdf",
  "documents/report-v2.svg",
  "documents/report-v12.4.docx",
  "documents/report_V1.1.md",
  "documents/report-2026-08-30.xlsx",
  "documents/report-20260830.pptx",
  "documents/evidence-semantics-and-scanner-orchestration-v1.3.pdf",
  "documents/evidence-semantics-and-scanner-orchestration-v1.4.pdf",
  "documents/security-observatory-reference-architecture-v4.1.svg",
  "documents/security-observatory-reference-architecture-v4.2.svg",
  "EVIDENCE_TERMINOLOGY_CONTRACT_V1.1.md"
]) assert.ok(publicDocumentPathErrors([rejectedPath]).length > 0, `expected public document path rejection for ${rejectedPath}`);
assert.ok(publicDocumentPathErrors(["CURRENT_REPORT.md"]).some((value) => value.includes("CURRENT_")));
assert.deepEqual(publicDocumentPathErrors([
  "documents/report.pdf",
  "documents/reference.svg",
  "EVIDENCE_TERMINOLOGY_CONTRACT.md",
  "document-src/report-v2.html",
  "assets/preview-2026-08-30.jpg",
  "assets/site.a02e800f31c0.css"
]), []);

assert.throws(() => replaceExactly("no marker", "required marker", "replacement", "fixture"), /expected 1 source occurrence/u);
assert.throws(() => replaceExactly("required marker required marker", "required marker", "replacement", "fixture"), /found 2/u);
assert.equal(replaceExactly("before required marker after", "required marker", "replacement", "fixture"), "before replacement after");

const duplicateCanonical = '<link rel="canonical" href="https://fortmilo.co.uk/"><link rel="canonical" href="https://fortmilo.co.uk/">';
assert.ok(canonicalMetadataErrors(duplicateCanonical, "https://fortmilo.co.uk/").some((value) => value.includes("exactly one canonical")));
assert.ok(uniqueIdErrors('<main id="main"><p id="main"></p></main>').some((value) => value.includes("duplicate id")));
assert.ok(imageMarkupErrors('<img src="/asset.png" alt="">').some((value) => value.includes("declared width")));
assert.deepEqual(imageMarkupErrors('<img src="/asset.png" alt="" width="10" height="20">'), []);
assert.deepEqual(landmarkErrors('<a class="skip-link" href="#main">Skip</a><header class="site-header"></header><nav aria-label="Main"></nav><main id="main"><h1>Title</h1></main><footer class="site-footer"></footer>'), []);
assert.ok(prohibitedPublicClaimErrors("<p>AppExchange certified</p>").length > 0);

const duplicateNavigation = '<nav class="corporate-nav" aria-label="Corporate"><a aria-current="page"></a><a aria-current="page"></a></nav>';
assert.ok(navigationStateErrors(duplicateNavigation, { corporateActive: "home" }).some((value) => value.includes("found 2")));

const referenceFixture = new Map([
  ["index.html", Buffer.from('<a href="/target.html#present">valid</a>')],
  ["target.html", Buffer.from('<main id="present"></main>')]
]);
assert.deepEqual(publicationReferenceErrors(referenceFixture), []);
referenceFixture.set("index.html", Buffer.from('<a href="/target.html#missing">invalid</a>'));
assert.ok(publicationReferenceErrors(referenceFixture).some((value) => value.includes("no target id")));
referenceFixture.set("index.html", Buffer.from('<a href="/missing.html#missing">invalid</a>'));
assert.ok(publicationReferenceErrors(referenceFixture).some((value) => value.includes("no exact case-sensitive")));

const pngAsset = governedAssets.find((asset) => asset.path === "favicon-16x16.png");
const pngBytes = await readFile(path.join(root, pngAsset.path));
assert.deepEqual(governedAssetErrors(pngAsset, pngBytes), []);
const alteredBytes = Buffer.from(pngBytes);
alteredBytes[alteredBytes.length - 1] ^= 1;
assert.ok(governedAssetErrors(pngAsset, alteredBytes).length > 0, "altered governed asset bytes must fail");
const alteredDimensions = Buffer.from(pngBytes);
alteredDimensions.writeUInt32BE(17, 16);
assert.ok(governedAssetErrors(pngAsset, alteredDimensions).length > 0, "altered PNG dimensions must fail");

console.log("Validated public-site contract fixtures");
