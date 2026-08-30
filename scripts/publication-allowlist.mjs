import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { publicDocumentPathErrors } from "./public-site-contract.mjs";
import { governedAssets } from "./governed-assets.mjs";

const lexicalCompare = (left, right) => left < right ? -1 : left > right ? 1 : 0;

export const rootRouteFiles = Object.freeze([
  "404.html",
  "acknowledgements.html",
  "architecture-security.html",
  "contact.html",
  "index.html",
  "privacy.html",
  "terms.html"
]);

export const rootSupportFiles = Object.freeze([
  ".nojekyll",
  ".well-known/security.txt",
  "CNAME",
  ...governedAssets.filter((asset) => !asset.path.includes("/")).map((asset) => asset.path),
  "robots.txt",
  "site.webmanifest",
  "sitemap.xml"
]);

export const customerRouteFiles = Object.freeze([
  "documents/index.html",
  "security-observatory/entitlements-assets.html",
  "security-observatory/evidence.html",
  "security-observatory/external-connections.html",
  "security-observatory/findings.html",
  "security-observatory/identity-access.html",
  "security-observatory/index.html"
]);

export const fixedAssetFiles = Object.freeze(
  governedAssets.filter((asset) => asset.path.startsWith("assets/")).map((asset) => asset.path)
);

export const obsoleteOperationalFiles = Object.freeze([
  "pages-deployment-trigger.txt",
  "scripts/validator-payload/part-01.txt",
  "scripts/validator-payload/part-02.txt",
  "scripts/validator-payload/part-03.txt",
  "scripts/validator-payload/part-04.txt"
]);

export const explicitlyExcludedUrls = Object.freeze([
  "/.github/workflows/validate-site.yml",
  "/AGENTS.md",
  "/CLAUDE.md",
  "/CURRENT_EVIDENCE_TERMINOLOGY_CONTRACT.md",
  "/EVIDENCE_TERMINOLOGY_CONTRACT_V1.1.md",
  "/README.md",
  "/document-src/",
  "/package-lock.json",
  "/package.json",
  ...obsoleteOperationalFiles.map((file) => `/${file}`),
  "/documents/evidence-semantics-and-scanner-orchestration-v1.3.pdf",
  "/documents/evidence-semantics-and-scanner-orchestration-v1.4.pdf",
  "/documents/orchestrating-ai-for-secure-software-delivery-v1.0.pdf",
  "/documents/security-observatory-reference-architecture-v4.1.svg",
  "/documents/security-observatory-reference-architecture-v4.2.svg",
  "/scripts/build-site.mjs",
  "/scripts/validator-payload/",
  "/site-src/"
]);

// These are deliberately public, stable document URLs. Their maintained generation
// sources remain private to the repository and are not part of the publication set.
export const approvedDocumentFiles = Object.freeze([
  "documents/evidence-semantics-and-scanner-orchestration.pdf",
  "documents/orchestrating-ai-for-secure-software-delivery.pdf",
  "documents/security-observatory-reference-architecture.svg"
]);

// This Markdown contract has one intentional stable public URL. No other repository
// Markdown file is approved merely because it is tracked beside them.
export const publicTerminologyContractFiles = Object.freeze([
  "EVIDENCE_TERMINOLOGY_CONTRACT.md"
]);

// CSS names are content-addressed by the maintained site build. Only these two
// precisely named source files may introduce a derived publication path.
export const publicationStylesheetSources = Object.freeze([
  Object.freeze({ source: "site-src/home.css", publicPrefix: "assets/home." }),
  Object.freeze({ source: "site-src/styles.css", publicPrefix: "assets/site." })
]);

export const requiredHiddenFiles = Object.freeze([
  ".nojekyll",
  ".well-known/security.txt"
]);

export const intendedRouteFiles = Object.freeze([
  ...rootRouteFiles,
  ...customerRouteFiles
]);

export function validatePublicationPaths(files) {
  const seen = new Set();

  const documentPathErrors = publicDocumentPathErrors(files);
  if (documentPathErrors.length) throw new Error(documentPathErrors[0]);

  for (const file of files) {
    if (typeof file !== "string" || !file) throw new Error("publication paths must be non-empty strings");
    if (file.includes("\\")) throw new Error(`publication path must use forward slashes: ${file}`);
    if (path.posix.isAbsolute(file) || path.win32.isAbsolute(file)) {
      throw new Error(`publication path must be relative: ${file}`);
    }
    if (path.posix.normalize(file) !== file) throw new Error(`publication path is not normalised: ${file}`);
    if (file.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
      throw new Error(`publication path contains an unsafe segment: ${file}`);
    }
    if (seen.has(file)) throw new Error(`duplicate publication path: ${file}`);
    seen.add(file);
  }

  return [...files].sort(lexicalCompare);
}

export async function getPublicationAllowlist(repositoryRoot) {
  const derivedStylesheets = [];

  for (const stylesheet of publicationStylesheetSources) {
    const sourcePath = path.resolve(repositoryRoot, ...stylesheet.source.split("/"));
    const content = (await readFile(sourcePath, "utf8")).replace(/\r\n?/gu, "\n");
    const digest = createHash("sha256").update(content).digest("hex").slice(0, 12);
    derivedStylesheets.push(`${stylesheet.publicPrefix}${digest}.css`);
  }

  return Object.freeze(validatePublicationPaths([
    ...rootRouteFiles,
    ...rootSupportFiles,
    ...customerRouteFiles,
    ...fixedAssetFiles,
    ...derivedStylesheets,
    ...approvedDocumentFiles,
    ...publicTerminologyContractFiles
  ]));
}
