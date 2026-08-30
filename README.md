# Fortmilo website

Source for [fortmilo.co.uk](https://fortmilo.co.uk), published through a GitHub Actions Pages workflow from a deliberately allow-listed `_site/` artifact.

The site is operated by Luca Pacini, trading as Fortmilo, in Harpenden, Hertfordshire, United Kingdom.

## Build

The site uses a local Node.js static generator. Generated HTML and static assets are committed to `main`, then the deployment workflow validates and copies only approved public files into `_site/`. GitHub Pages never publishes the repository root.

```bash
npm run build
npm run validate
npm run check
npm run build:publication
npm run validate:publication
npm run generate:ai-methodology
```

- Page content stays in the generated HTML; shared layout is applied from one template source.
- `site-src/templates.mjs` owns the shared header, product navigation, metadata and footer.
- `site-src/site-map.mjs` owns routes and active navigation.
- `scripts/build-site.mjs` applies shared layout, generates the stylesheet asset, sitemap and static hosting files.
- `scripts/publication-allowlist.mjs` is the single authoritative file-level publication manifest, including content-addressed CSS paths derived from the maintained stylesheet sources.
- `scripts/build-publication-artifact.mjs` rebuilds `_site/` solely from that manifest and records deterministic inventory evidence outside the public artifact.
- `scripts/validate-publication-artifact.mjs` independently verifies the exact artifact inventory, source hashes, required public routes, prohibited operational paths and internal links.
- `document-src/orchestrating-ai-for-secure-software-delivery.html` is the semantic maintained source for the accessible methodology paper; `scripts/generate-ai-methodology-paper.mjs` regenerates its one stable public PDF path.
- `scripts/validate-ai-methodology-paper.mjs` checks publication metadata, tagging, headings, lists, tables, figure alternatives, bookmarks, URI links, reading-order tabs and embedded fonts.
- `scripts/validate-site.mjs` checks routes, metadata, shared navigation, product wording and public-safety constraints.
- `scripts/generate-brand-assets.ps1` reproduces the social JPEG from the approved public banner export.
- `.github/workflows/validate-site.yml` runs the build, site contract and publication-accessibility assertions for pull requests and protected publication branches.

## Stable document publication

Every public document has one stable filename and URL. Updates replace that file in place; versioned, dated, immutable, `CURRENT_` alias, superseded and historical public copies are not published. Git history preserves previous editions. This applies to PDFs, SVGs, Markdown contracts and future downloadable documents.

## Approved public artwork

- `/assets/fortmilo-brand-banner-1200x675.png`: approved homepage banner export and social-preview source.
- `/assets/fortmilo-shield-512.png`: approved compact header mark.
- `/assets/fortmilo-security-observatory-og-20260731.jpg`: derived 1200×630 social preview.
- Root favicon, Apple and Microsoft tile files plus `/assets/android-chrome-192x192.png` and `/assets/android-chrome-512x512.png`: approved platform-specific icon exports.

## Boundaries

- Corporate site and Security Observatory product guide only.
- No customer data, org evidence, credentials, tokens, session IDs, secrets, certificate bodies, private keys, raw IP addresses or production screenshots.
- Product screenshots must come from a sanitised evidence set.
- Security Observatory remains sandbox-first and advisory, with read-only assessment of Salesforce security configuration.
- The public product repository is a curated release surface, not a mirror of private implementation history.

## Contact

- Luca Pacini
- Luca Pacini, trading as Fortmilo
- Harpenden, Hertfordshire, United Kingdom
- [info@fortmilo.co.uk](mailto:info@fortmilo.co.uk)
