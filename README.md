# FortMilo website

Source for [fortmilo.co.uk](https://fortmilo.co.uk), published from the `main` branch through GitHub Pages.

FortMilo Lab is an independent personal project and brand operated by Luca Pacini in Harpenden, Hertfordshire, United Kingdom.

## Build

The site uses a local Node.js static generator with no external dependencies. Generated HTML and static assets are committed to `main`; GitHub Pages does not run a custom build workflow.

```bash
npm run build
npm run validate
npm run check
```

- Page content stays in the generated HTML; shared layout is applied from one template source.
- `site-src/templates.mjs` owns the shared header, product navigation, metadata and footer.
- `site-src/site-map.mjs` owns routes and active navigation.
- `scripts/build-site.mjs` applies shared layout, generates the stylesheet asset, sitemap and static hosting files.
- `scripts/validate-site.mjs` checks routes, metadata, shared navigation, product wording and public-safety constraints.
- No GitHub Actions workflow is required.

## Boundaries

- Corporate site and Security Observatory product guide only.
- No customer data, org evidence, credentials, tokens, session IDs, secrets, certificate bodies, private keys, raw IP addresses or production screenshots.
- Product screenshots must come from a sanitised evidence set.
- Security Observatory remains read-only, sandbox-first and advisory.
- The public product repository is a curated release surface, not a mirror of private implementation history.

## Contact

- Luca Pacini
- Individual applicant and operator of FortMilo Lab
- Harpenden, Hertfordshire, United Kingdom
- [info@fortmilo.co.uk](mailto:info@fortmilo.co.uk)
