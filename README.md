# FortMilo website

Source for [fortmilo.co.uk](https://fortmilo.co.uk), published from the `main` branch through GitHub Pages.

## Build

The site uses a local Node.js generator with no external dependencies.

```bash
npm run build
npm run check
```

- `build.mjs` owns the shared layout, metadata, sitemap generation and validation.
- Page-specific `<main>` content stays in the committed HTML so the site remains deployable without a build service.
- Generated HTML, sitemap and manifest files are committed.
- The stylesheet query token is generated from the SHA-256 hash of `styles.css`.
- No GitHub Actions workflow is required.

## Boundaries

- Corporate and product guide only.
- No customer data, org evidence, credentials, tokens, session IDs, secrets, certificate bodies, private keys, raw IP addresses or production screenshots.
- Product screenshots must come from a sanitised clean-org evidence set.
- Security Observatory remains read-only, sandbox-first and advisory.
- The public product repository is a curated release surface, not a mirror of private implementation history.

## Contact

[info@fortmilo.co.uk](mailto:info@fortmilo.co.uk)
