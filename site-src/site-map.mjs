import { publicationDates } from "./publication-metadata.mjs";

// Significant updates through 19 August 2026: canonical product naming, shared footer discoverability, architecture boundary wording and route-wide accessibility corrections.
export const routes = [
  { output: "index.html", canonical: "https://fortmilo.co.uk/", lastmod: publicationDates.site, corporateActive: "home" },
  { output: "security-observatory/index.html", canonical: "https://fortmilo.co.uk/security-observatory/", lastmod: publicationDates.site, corporateActive: "observatory", productActive: "overview" },
  { output: "security-observatory/findings.html", canonical: "https://fortmilo.co.uk/security-observatory/findings.html", lastmod: publicationDates.site, corporateActive: "observatory", productActive: "findings" },
  { output: "security-observatory/identity-access.html", canonical: "https://fortmilo.co.uk/security-observatory/identity-access.html", lastmod: publicationDates.site, corporateActive: "observatory", productActive: "identity" },
  { output: "security-observatory/external-connections.html", canonical: "https://fortmilo.co.uk/security-observatory/external-connections.html", lastmod: publicationDates.site, corporateActive: "observatory", productActive: "connections" },
  { output: "security-observatory/entitlements-assets.html", canonical: "https://fortmilo.co.uk/security-observatory/entitlements-assets.html", lastmod: publicationDates.site, corporateActive: "observatory", productActive: "entitlements" },
  { output: "security-observatory/evidence.html", canonical: "https://fortmilo.co.uk/security-observatory/evidence.html", lastmod: publicationDates.site, corporateActive: "observatory", productActive: "evidence" },
  { output: "architecture-security.html", canonical: "https://fortmilo.co.uk/architecture-security.html", lastmod: publicationDates.site, corporateActive: "architecture" },
  { output: "documents/index.html", canonical: "https://fortmilo.co.uk/documents/", lastmod: publicationDates.site, corporateActive: "documents" },
  { output: "acknowledgements.html", canonical: "https://fortmilo.co.uk/acknowledgements.html", lastmod: publicationDates.site },
  { output: "contact.html", canonical: "https://fortmilo.co.uk/contact.html", lastmod: publicationDates.site },
  { output: "privacy.html", canonical: "https://fortmilo.co.uk/privacy.html", lastmod: publicationDates.site },
  { output: "terms.html", canonical: "https://fortmilo.co.uk/terms.html", lastmod: publicationDates.site },
  { output: "404.html", canonical: "https://fortmilo.co.uk/404.html", noindex: true }
];

export const documentAssets = [
  { output: "documents/evidence-semantics-and-scanner-orchestration.pdf", canonical: "https://fortmilo.co.uk/documents/evidence-semantics-and-scanner-orchestration.pdf", lastmod: publicationDates.evidencePaper },
  { output: "documents/orchestrating-ai-for-secure-software-delivery.pdf", canonical: "https://fortmilo.co.uk/documents/orchestrating-ai-for-secure-software-delivery.pdf", lastmod: publicationDates.methodologyPaper },
  { output: "documents/security-observatory-reference-architecture.svg", canonical: "https://fortmilo.co.uk/documents/security-observatory-reference-architecture.svg", lastmod: publicationDates.referenceArchitecture },
  { output: "EVIDENCE_TERMINOLOGY_CONTRACT.md", canonical: "https://fortmilo.co.uk/EVIDENCE_TERMINOLOGY_CONTRACT.md", lastmod: publicationDates.terminologyContract }
];

export const sitemapEntries = Object.freeze([...routes.filter((route) => !route.noindex), ...documentAssets]);

export function renderSitemap() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.map((entry) => `  <url><loc>${entry.canonical}</loc><lastmod>${entry.lastmod}</lastmod></url>`).join("\n")}\n</urlset>\n`;
}
