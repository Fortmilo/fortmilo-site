import { readFile, writeFile } from "node:fs/promises";

const TODAY = "2026-08-19";
const REQUEST_ACCESS_HREF =
  "mailto:info@fortmilo.co.uk?subject=Security%20Observatory%20%E2%80%94%20request%20access%20when%20available";

function occurrenceCount(text, token) {
  return text.split(token).length - 1;
}

async function replaceExact(file, from, to, expected = 1) {
  const text = await readFile(file, "utf8");
  const actual = occurrenceCount(text, from);
  if (actual !== expected) {
    throw new Error(
      `${file}: expected ${expected} occurrence(s) of ${JSON.stringify(from)}, found ${actual}`
    );
  }
  await writeFile(file, text.split(from).join(to), "utf8");
}

async function transform(file, fn) {
  const text = await readFile(file, "utf8");
  const next = fn(text);
  if (next === text) throw new Error(`${file}: transformation made no change`);
  await writeFile(file, next, "utf8");
}

// Shared footer: make Acknowledgements visible on every route.
await replaceExact(
  "site-src/templates.mjs",
  '<div class="footer-links"><a href="/contact.html">Contact</a><a href="/privacy.html">Privacy</a>',
  '<div class="footer-links"><a href="/contact.html">Contact</a><a href="/acknowledgements.html">Acknowledgements</a><a href="/privacy.html">Privacy</a>'
);

// Every indexed route changes because the shared footer changes.
await transform("site-src/site-map.mjs", (text) => {
  const matches = [...text.matchAll(/lastmod: "\d{4}-\d{2}-\d{2}"/gu)];
  if (matches.length !== 13) {
    throw new Error(
      `site-src/site-map.mjs: expected 13 lastmod values, found ${matches.length}`
    );
  }
  return text.replace(
    /lastmod: "\d{4}-\d{2}-\d{2}"/gu,
    `lastmod: "${TODAY}"`
  );
});

// Current website governance must reflect the later availability decision.
await replaceExact(
  "CLAUDE.md",
  '3. Add shared availability/status visibility: **Product status: Sandbox validation. Not yet available for public installation.**',
  '3. Keep sandbox-validation status on Home and Overview, and use **Request access when available** as the practical availability mechanism. Do not add a global availability banner/footer or repeat availability disclaimers on every technical page.'
);

// Architecture boundary wording.
await replaceExact(
  "architecture-security.html",
  '<li><strong>Read-only first</strong><span>No security remediation or production write-back.</span></li>',
  '<li><strong>Read-only assessment</strong><span>No security remediation or write-back to assessed Salesforce configuration.</span></li>'
);

// Homepage naming and access request.
await replaceExact(
  "index.html",
  "FortMilo Security Observatory brings OAuth grants, privileged access, licences, external exposure and retained security evidence into one Salesforce-native review surface.",
  "Security Observatory brings OAuth grants, privileged access, licences, external exposure and retained security evidence into one Salesforce-native review surface."
);
await replaceExact(
  "index.html",
  "FortMilo Security Observatory brings supported signals into one review surface, retains sanitised evidence and makes changes easier to investigate over time.",
  "Security Observatory brings supported signals into one review surface, retains sanitised evidence and makes changes easier to investigate over time."
);
await replaceExact(
  "index.html",
  '<div class="actions"><a class="button button-primary" href="/security-observatory/">Explore Security Observatory</a><a class="button button-secondary" href="/contact.html">Contact</a></div>',
  `<div class="actions"><a class="button button-primary" href="/security-observatory/">Explore Security Observatory</a><a class="button button-secondary" href="${REQUEST_ACCESS_HREF}">Request access when available</a></div>`
);

// Product Overview naming, count, H1 and access request.
await replaceExact(
  "security-observatory/index.html",
  "Overview of Security Observatory by FortMilo, Salesforce security evidence organised for review.",
  "Overview of Security Observatory for reviewing Salesforce security evidence.",
  2
);
await replaceExact(
  "security-observatory/index.html",
  '<div><p class="eyebrow">Security Observatory by FortMilo</p><h1>Everything you need to review, in one place.</h1><p class="lead">Six review areas covering findings, identity, external connections, entitlements and the evidence behind them. Assessment and retained evidence stay inside Salesforce.</p></div>',
  `<div><p class="eyebrow">Overview</p><h1>Security Observatory</h1><p class="lead">Everything you need to review, in one place. Five review areas covering findings, identity, external connections, entitlements and the evidence behind them. Assessment and retained evidence stay inside Salesforce.</p><div class="actions"><a class="button button-secondary" href="${REQUEST_ACCESS_HREF}">Request access when available</a></div></div>`
);

// Documents naming and duplicated disclaimer.
await replaceExact(
  "documents/index.html",
  "Technical whitepapers, architecture diagrams and independent research for Security Observatory by FortMilo.",
  "Technical whitepapers, architecture diagrams and independent research for Security Observatory.",
  2
);
await replaceExact(
  "documents/index.html",
  "These publications provide wider technical context and are not FortMilo Security Observatory product documentation.",
  "These publications provide wider technical context and are not Security Observatory product documentation."
);
await replaceExact(
  "documents/index.html",
  "A Security Observatory case study in human authority, evidence gates and multi-model engineering. Written for engineering and governance readers; it is not product documentation.",
  "A Security Observatory case study in human authority, evidence gates and multi-model engineering. Written for engineering and governance readers."
);

// Correct the three heading-level gaps without changing visual hierarchy.
const cardHeadings = {
  "security-observatory/identity-access.html": [
    "User posture",
    "Sessions and logins",
    "Broad access",
  ],
  "security-observatory/external-connections.html": [
    "OAuth grants requiring review",
    "Connected App Evidence Passport",
    "Credentials and surfaces",
  ],
  "security-observatory/entitlements-assets.html": [
    "Licence posture",
    "Assignment source",
    "Governed assets",
  ],
};
for (const [file, headings] of Object.entries(cardHeadings)) {
  for (const heading of headings) {
    await replaceExact(
      file,
      `<h3>${heading}</h3>`,
      `<h2 class="card-title">${heading}</h2>`
    );
  }
}

await transform("site-src/styles.css", (text) => {
  if (text.includes(".card-title {")) {
    throw new Error("site-src/styles.css: .card-title already exists");
  }
  const anchor = ".card h3 { text-wrap: balance; }";
  if (!text.includes(anchor)) {
    throw new Error("site-src/styles.css: card heading anchor missing");
  }
  return text.replace(
    anchor,
    `${anchor}
.card-title { margin: 0 0 .5rem; font-size: 1.14rem; line-height: 1.28; letter-spacing: normal; text-wrap: balance; }`
  );
});

// Reference-architecture title: product name and provenance remain separate.
await replaceExact(
  "documents/security-observatory-reference-architecture-v4.1.svg",
  '<title id="soTitle">Security Observatory by FortMilo — reference architecture</title>',
  '<title id="soTitle">Security Observatory — reference architecture</title>'
);
await replaceExact(
  "documents/security-observatory-reference-architecture-v4.1.svg",
  ">Security Observatory by FortMilo</text>",
  ">Security Observatory</text>"
);

// Add reusable whole-site contract helpers and fixture tests.
await writeFile(
  "scripts/site-contract.mjs",
  `const prohibitedFormalNames = [
  "FortMilo Security Observatory",
  "Fortmilo Security Observatory",
  "FORTMILO Security Observatory",
  "Salesforce Security Observatory"
];

const exceptionalName = "Security Observatory by FortMilo";
const approvedExceptionalLocations = new Set();

function visibleText(html) {
  const noComments = html.replace(/<!--[\\s\\S]*?-->/gu, " ");
  const jsonLd = [...noComments.matchAll(/<script\\b[^>]*type="application\\/ld\\+json"[^>]*>([\\s\\S]*?)<\\/script>/giu)]
    .map((match) => match[1])
    .join(" ");
  const withoutScripts = noComments
    .replace(/<script\\b[\\s\\S]*?<\\/script>/giu, " ")
    .replace(/<style\\b[\\s\\S]*?<\\/style>/giu, " ");
  const textNodes = withoutScripts.replace(/<[^>]+>/gu, " ");
  const namedAttributes = [...noComments.matchAll(/\\b(?:alt|aria-label)="([^"]*)"/giu)]
    .map((match) => match[1]);
  const metadata = [...noComments.matchAll(/<meta\\b[^>]*(?:name|property)="(?:description|og:description|og:title|og:image:alt|twitter:image:alt)"[^>]*content="([^"]*)"[^>]*>/giu)]
    .map((match) => match[1]);
  return [textNodes, jsonLd, ...namedAttributes, ...metadata]
    .join(" ")
    .replace(/\\s+/gu, " ");
}

export function headingErrors(html) {
  const clean = html.replace(/<!--[\\s\\S]*?-->/gu, " ");
  const levels = [...clean.matchAll(/<h([1-6])\\b[^>]*>/giu)]
    .map((match) => Number(match[1]));
  const errors = [];
  const h1Count = levels.filter((level) => level === 1).length;
  if (h1Count !== 1) errors.push(\`expected exactly one H1, found \${h1Count}\`);
  if (levels.length && levels[0] !== 1) errors.push("H1 must be the first heading");
  for (let index = 1; index < levels.length; index += 1) {
    if (levels[index] > levels[index - 1] + 1) {
      errors.push(\`skipped heading level H\${levels[index - 1]} to H\${levels[index]}\`);
    }
  }
  return errors;
}

export function namingErrors(html, route) {
  const surface = visibleText(html);
  const errors = [];
  for (const name of prohibitedFormalNames) {
    if (surface.includes(name)) {
      errors.push(\`prohibited customer-visible name: \${name}\`);
    }
  }
  if (
    surface.includes(exceptionalName) &&
    !approvedExceptionalLocations.has(route)
  ) {
    errors.push(
      \`unapproved routine use of exceptional name: \${exceptionalName}\`
    );
  }
  return errors;
}
`,
  "utf8"
);

await writeFile(
  "scripts/test-site-contract.mjs",
  `import assert from "node:assert/strict";
import { headingErrors, namingErrors } from "./site-contract.mjs";

assert.deepEqual(
  headingErrors("<h1>A</h1><h2>B</h2><h3>C</h3>"),
  []
);
assert.ok(
  headingErrors("<h1>A</h1><h3>C</h3>").some((value) =>
    value.includes("skipped")
  )
);
assert.ok(
  headingErrors("<h1>A</h1><h1>B</h1>").some((value) =>
    value.includes("exactly one")
  )
);
assert.ok(
  headingErrors("<h2>B</h2><h1>A</h1>").some((value) =>
    value.includes("first heading")
  )
);
assert.equal(
  namingErrors("<p>Salesforce Security Observatory</p>", "test.html").length,
  1
);
assert.equal(
  namingErrors("<p>Security Observatory by FortMilo</p>", "test.html").length,
  1
);
assert.deepEqual(
  namingErrors(
    '<a href="https://github.com/Fortmilo/fortmilo-site/">Repository</a><img src="fortmilo-security-observatory-og-20260731.jpg" alt="FortMilo — Security Observatory">',
    "test.html"
  ),
  []
);

console.log("Validated site-contract fixtures");
`,
  "utf8"
);

// Wire the helpers into all rendered routes.
await replaceExact(
  "scripts/validate-site.mjs",
  'import { routes } from "../site-src/site-map.mjs";\n',
  'import { routes } from "../site-src/site-map.mjs";\nimport { headingErrors, namingErrors } from "./site-contract.mjs";\n'
);

const duplicateAnchor =
  '  if (duplicates.length) errors.push(`${route.output}: duplicate ids ${duplicates.join(", ")}`);\n';
await replaceExact(
  "scripts/validate-site.mjs",
  duplicateAnchor,
  `${duplicateAnchor}
  for (const message of headingErrors(html)) errors.push(\`${"${route.output}"}: \${message}\`);
  for (const message of namingErrors(html, route.output)) errors.push(\`${"${route.output}"}: \${message}\`);
`
);

await replaceExact(
  "scripts/validate-site.mjs",
  '    \'href="/contact.html">Contact</a>\',\n    \'href="/privacy.html">Privacy</a>\',',
  '    \'href="/contact.html">Contact</a>\',\n    \'href="/acknowledgements.html">Acknowledgements</a>\',\n    \'href="/privacy.html">Privacy</a>\','
);
await replaceExact(
  "scripts/validate-site.mjs",
  '  if (footer.includes(\'href="/acknowledgements.html"\')) errors.push(`${route.output} footer: Acknowledgements must remain a secondary link`);\n',
  ""
);
await replaceExact(
  "scripts/validate-site.mjs",
  "FortMilo Security Observatory brings OAuth grants, privileged access, licences, external exposure and retained security evidence into one Salesforce-native review surface.",
  "Security Observatory brings OAuth grants, privileged access, licences, external exposure and retained security evidence into one Salesforce-native review surface."
);
await replaceExact(
  "scripts/validate-site.mjs",
  "<h1>Everything you need to review, in one place.</h1>",
  "<h1>Security Observatory</h1>"
);
await replaceExact(
  "scripts/validate-site.mjs",
  "Six review areas covering findings, identity, external connections, entitlements and the evidence behind them. Assessment and retained evidence stay inside Salesforce.",
  "Everything you need to review, in one place. Five review areas covering findings, identity, external connections, entitlements and the evidence behind them. Assessment and retained evidence stay inside Salesforce."
);
await replaceExact(
  "scripts/validate-site.mjs",
  "These publications provide wider technical context and are not FortMilo Security Observatory product documentation.",
  "These publications provide wider technical context and are not Security Observatory product documentation."
);

await transform("scripts/validate-site.mjs", (text) => {
  const imageBlock =
    'for (const image of allFiles.filter((file) => /\\.(?:png|jpe?g|ico|svg)$/iu.test(file))) {\n' +
    '  const info = await stat(path.join(root, image));\n' +
    '  if (info.size === 0) errors.push(`${image}: empty image asset`);\n' +
    '}\n';
  if (!text.includes(imageBlock)) {
    throw new Error(
      "scripts/validate-site.mjs: image validation anchor missing"
    );
  }
  const svgChecks =
    `${imageBlock}\n` +
    'const architectureSvg = await readText("documents/security-observatory-reference-architecture-v4.1.svg");\n' +
    'requireAll(architectureSvg, [\n' +
    '  \'<title id="soTitle">Security Observatory — reference architecture</title>\',\n' +
    '  \'>Security Observatory</text>\'\n' +
    '], "reference architecture SVG");\n' +
    'prohibitAll(architectureSvg, ["Security Observatory by FortMilo"], "reference architecture SVG");\n';
  return text.replace(imageBlock, svgChecks);
});

await replaceExact(
  "package.json",
  '"validate": "node scripts/validate-site.mjs"',
  '"validate": "node scripts/test-site-contract.mjs && node scripts/validate-site.mjs"'
);

console.log(`Applied approved FortMilo site update with lastmod ${TODAY}`);
