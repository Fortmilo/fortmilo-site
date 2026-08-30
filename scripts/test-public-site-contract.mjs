import assert from "node:assert/strict";
import {
  customerVisibleSurface,
  deploymentTriggerPublicationDateErrors,
  evidenceTerminologyErrors,
  headingErrors,
  namingErrors,
  prohibitedEvidenceClaims,
  publicDocumentPathErrors,
  publicCopyRevisionErrors
} from "./public-site-contract.mjs";

// Regression fixtures for the public naming and heading contract.
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
]) {
  assert.ok(namingErrors(html, "test.html").length > 0, `expected naming failure for ${html}`);
}

for (const html of [
  '<p>Fortmilo</p>',
  '<nav aria-label="Security Observatory by Fortmilo"></nav>',
  '<img src="/assets/fortmilo-security-observatory-og-20260731.jpg" alt="Fortmilo — Security Observatory">'
]) assert.deepEqual(namingErrors(html, "test.html"), []);

const surface = customerVisibleSurface('<meta name="description" content="Safe description"><img src="unsafe-name.jpg" alt="Safe alt">');
assert.ok(surface.includes("Safe description"));
assert.ok(surface.includes("Safe alt"));
assert.ok(!surface.includes("unsafe-name.jpg"));

for (const claim of prohibitedEvidenceClaims) {
  assert.ok(
    evidenceTerminologyErrors(`<p>${claim}</p>`).length > 0,
    `expected evidence-semantics failure for ${claim}`
  );
}

assert.deepEqual(evidenceTerminologyErrors(`
  <p>Not assessed means work was not performed or the question was outside the assessed scope.</p>
  <p>Not retained at this evidence level and Not captured identify intentional detail omissions.</p>
  <p>Coverage type describes how far available evidence can assess the mapped question. It is neither confidence nor the selected evidence detail level.</p>
  <p>Coverage tiles, including Partial Evidence, remain separate from control-outcome tiles and filters.</p>
  <p>Collection and retention occur inside the subscriber Salesforce organisation. The LWC prepares the allow-listed CSV in the authenticated browser session; downloading it creates a file outside Salesforce.</p>
`), []);

const currentPublicationDate = "2026-08-29";
assert.deepEqual(publicCopyRevisionErrors(
  `<main data-public-copy-revision="${currentPublicationDate}"></main>`,
  currentPublicationDate
), []);
assert.ok(publicCopyRevisionErrors(
  '<main data-public-copy-revision="2026-08-19"></main>',
  currentPublicationDate
).some((value) => value.includes("does not match current publication date")));

assert.deepEqual(
  deploymentTriggerPublicationDateErrors(`Fortmilo public site deployment trigger — ${currentPublicationDate}`, currentPublicationDate),
  []
);
assert.ok(deploymentTriggerPublicationDateErrors(
  "Fortmilo public site deployment trigger — 2026-08-19",
  currentPublicationDate
).some((value) => value.includes("does not match current publication date")));

// Rejection fixtures for public downloadable-document filenames.
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
]) {
  assert.ok(publicDocumentPathErrors([rejectedPath]).length > 0, `expected public document path rejection for ${rejectedPath}`);
}
assert.ok(publicDocumentPathErrors(["CURRENT_REPORT.md"]).some((value) => value.includes("CURRENT_")));
assert.deepEqual(publicDocumentPathErrors([
  "documents/report.pdf",
  "documents/reference.svg",
  "EVIDENCE_TERMINOLOGY_CONTRACT.md",
  "document-src/report-v2.html",
  "assets/preview-2026-08-30.jpg",
  "assets/site.a02e800f31c0.css"
]), []);

console.log("Validated public-site contract fixtures");
