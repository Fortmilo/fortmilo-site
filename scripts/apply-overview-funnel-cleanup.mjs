import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const changed = [];

function replaceExact(text, from, to, expected, label) {
  const actual = text.split(from).length - 1;
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, found ${actual}`);
  return text.split(from).join(to);
}

async function rewrite(relative, transform) {
  const file = path.join(root, relative);
  const before = await readFile(file, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`${relative}: no change`);
  await writeFile(file, after, "utf8");
  changed.push(relative);
}

await rewrite("security-observatory/index.html", (input) => {
  let html = input;
  const oldHero = `<main id="main"><section class="page-hero"><div class="container hero-grid"><div><p class="eyebrow">Security Observatory by FortMilo</p><h1>Evidence organised for review.</h1><p class="lead">Security Observatory collects Salesforce security evidence, preserves provenance and presents focused review areas without exposing sensitive raw credential material. Automatic assessment and retained product evidence remain inside Salesforce; a user-initiated sanitised CSV download is a separate export boundary.</p></div><aside class="evidence-panel"><p>Product boundaries</p><ul class="fact-list"><li><strong>Runs inside Salesforce</strong><span>LWC, Apex and Salesforce data storage; explicit user export is a separate boundary.</span></li><li><strong>Read-only assessment</strong><span>The Observatory is advisory. It does not remediate or modify the Salesforce security configuration it assesses. Product-owned records retain scan results, evidence, findings and comparison data.</span></li><li><strong>Evidence-bounded</strong><span>Unavailable sources and validation limits remain visible.</span></li><li><strong>Sandbox-first</strong><span>Not yet available for public installation.</span></li></ul></aside></div></section><section class="section"><div class="container"><div class="section-heading"><p class="section-label">Product guide</p><h2>Overview plus five review areas</h2><p>Explore each documented review area without exposing organisation data or evidence values. The product source supporting source-established public claims is privately maintained; validation against the release build and target environment is stated separately.</p></div><div class="card-grid card-grid-five">`;
  const newHero = `<main id="main"><section class="page-hero"><div class="container hero-grid product-overview-hero"><div><p class="eyebrow">Security Observatory by FortMilo</p><h1>Everything you need to review, in one place.</h1><p class="lead">Six review areas covering findings, identity, external connections, entitlements and the evidence behind them. Assessment and retained evidence stay inside Salesforce.</p></div><!-- Dashboard screenshot slot: insert the approved sanitised product capture here when available. --></div></section><section class="section"><div class="container"><div class="section-heading"><p class="section-label">Product guide</p><h2>Overview plus five review areas</h2><p>Each review area shows what the Observatory surfaces and how far the evidence goes.</p></div><div class="card-grid card-grid-five">`;
  html = replaceExact(html, oldHero, newHero, 1, "overview hero and intro");

  const oldEnd = `</article></div></div></section></main>`;
  const newEnd = `</article></div><aside class="evidence-panel product-boundaries-panel"><p>Product boundaries</p><ul class="fact-list"><li><strong>Runs inside Salesforce</strong><span>LWC, Apex and Salesforce data storage; explicit user export is a separate boundary.</span></li><li><strong>Read-only assessment</strong><span>The Observatory is advisory. It does not remediate or modify the Salesforce security configuration it assesses. Product-owned records retain scan results, evidence, findings and comparison data.</span></li><li><strong>Evidence-bounded</strong><span>Unavailable sources and validation limits remain visible.</span></li><li><strong>Sandbox-first</strong><span>Not yet available for public installation.</span></li></ul></aside></div></section></main>`;
  html = replaceExact(html, oldEnd, newEnd, 1, "overview boundary relocation");
  return html;
});

await rewrite("security-observatory/evidence.html", (html) => replaceExact(
  html,
  `<p class="lead">Security Observatory uses evidence-bounded terminology and does not assert that a Security Benchmark for Salesforce (SBS) control is satisfied. The product implementation source supporting source-established statements is privately maintained; those statements remain self-attested unless a public artefact is cited. Validation against the release build and target environment is stated separately rather than implied.</p>`,
  `<p class="lead">Evidence state, coverage and limitation answer different questions, and the Observatory keeps them separate. Security Observatory uses evidence-bounded terminology and does not assert that a Security Benchmark for Salesforce (SBS) control is satisfied. The product implementation source supporting source-established statements is privately maintained; those statements remain self-attested unless a public artefact is cited. Validation against the release build and target environment is stated separately rather than implied.</p>`,
  1,
  "evidence lead"
));

await rewrite("security-observatory/identity-access.html", (html) => replaceExact(
  html,
  `<p class="lead">Inspect identity posture, login evidence and broad access signals without changing user access. Session identifiers are never displayed. Raw IP values are omitted or redacted; exact retained-data shape is validated per environment.</p>`,
  `<p class="lead">Inspect identity posture, login evidence and broad access signals without changing user access.</p>`,
  1,
  "identity lead"
));

await rewrite("security-observatory/entitlements-assets.html", (html) => replaceExact(
  html,
  `<p class="lead">Review licence usage, broad permissions and governed asset context without automatically removing access or changing commercial assignments. Running-user sharing, CRUD and field-level-security behaviour must be validated against the target release build, environment and user personas before being claimed.</p>`,
  `<p class="lead">Review licence usage, broad permissions and governed asset context without automatically removing access or changing commercial assignments.</p>`,
  1,
  "entitlements lead"
));

await rewrite("site-src/styles.css", (html) => {
  let css = html;
  css = replaceExact(css, `.hero-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 470px); align-items: center; gap: 3.25rem; padding-block: 3.4rem; }`, `.hero-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 470px); align-items: center; gap: 3.25rem; padding-block: 3.4rem; }\n.product-overview-hero { grid-template-columns: minmax(0, 1fr); }`, 1, "overview hero css");
  css = replaceExact(css, `.evidence-panel > p { margin: 0 0 .8rem; color: #c8d1de; font-size: .75rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }`, `.evidence-panel > p { margin: 0 0 .8rem; color: #c8d1de; font-size: .75rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }\n.product-boundaries-panel { margin-top: 1.5rem; }`, 1, "boundary panel css");
  return css;
});

await rewrite("site-src/site-map.mjs", (input) => {
  let text = input;
  for (const route of [
    "security-observatory/index.html",
    "security-observatory/identity-access.html",
    "security-observatory/entitlements-assets.html",
    "security-observatory/evidence.html"
  ]) {
    const re = new RegExp(`(output: \\\"${route.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\\"[^\\n]*lastmod: \\\")[0-9-]+(\\\")`, "u");
    if (!re.test(text)) throw new Error(`site map missing ${route}`);
    text = text.replace(re, `$12026-08-15$2`);
  }
  return text;
});

await rewrite("scripts/validate-site.mjs", (input) => {
  let text = input;
  const oldOverview = `const overview = htmlByRoute.get("security-observatory/index.html") || "";\nrequireAll(overview, [\n  "collects Salesforce security evidence",\n  "Read-only assessment",\n  "The Observatory is advisory. It does not remediate or modify the Salesforce security configuration it assesses.",\n  "Product-owned records retain scan results, evidence, findings and comparison data."\n], "security-observatory/index.html");\nprohibitAll(overview, ["collects read-only Salesforce evidence", "Read-only and advisory"], "security-observatory/index.html");`;
  const newOverview = `const overview = htmlByRoute.get("security-observatory/index.html") || "";\nrequireAll(overview, [\n  "<h1>Everything you need to review, in one place.</h1>",\n  '<p class="lead">Six review areas covering findings, identity, external connections, entitlements and the evidence behind them. Assessment and retained evidence stay inside Salesforce.</p>',\n  "Each review area shows what the Observatory surfaces and how far the evidence goes.",\n  "Dashboard screenshot slot: insert the approved sanitised product capture here when available.",\n  "Product boundaries",\n  "Read-only assessment",\n  "The Observatory is advisory. It does not remediate or modify the Salesforce security configuration it assesses.",\n  "Product-owned records retain scan results, evidence, findings and comparison data."\n], "security-observatory/index.html");\nprohibitAll(overview, [\n  "Evidence organised for review.",\n  "Security Observatory collects Salesforce security evidence, preserves provenance",\n  "Explore each documented review area without exposing organisation data or evidence values.",\n  "The product source supporting source-established public claims is privately maintained; validation against the release build and target environment is stated separately.",\n  "Read-only and advisory"\n], "security-observatory/index.html");\nif (!(overview.indexOf("Overview plus five review areas") < overview.indexOf("Product boundaries"))) errors.push("security-observatory/index.html: product boundaries must follow review-area cards");`;
  text = replaceExact(text, oldOverview, newOverview, 1, "validator overview contract");

  text = replaceExact(text, `  "Illustrative evidence state"\n], "security-observatory/evidence.html");`, `  "Illustrative evidence state",\n  "Evidence state, coverage and limitation answer different questions, and the Observatory keeps them separate.",\n  "The product implementation source supporting source-established statements is privately maintained; those statements remain self-attested unless a public artefact is cited."\n], "security-observatory/evidence.html");`, 1, "validator evidence lead contract");

  const oldIdentity = `const identity = htmlByRoute.get("security-observatory/identity-access.html") || "";\nconst identityBoundary = "Session identifiers are never displayed. Raw IP values are omitted or redacted; exact retained-data shape is validated per environment.";\nif (count(identity, identityBoundary) !== 2) errors.push("identity-access.html: expected customer-facing identity boundary twice");\nif (identity.includes("complete retained-data and export-shape validation remains environment-specific")) errors.push("identity-access.html: evidence-register wording returned");`;
  const newIdentity = `const identity = htmlByRoute.get("security-observatory/identity-access.html") || "";\nconst identityBoundary = "Session identifiers are never displayed. Raw IP values are omitted or redacted; exact retained-data shape is validated per environment.";\nrequireAll(identity, ['<p class="lead">Inspect identity posture, login evidence and broad access signals without changing user access.</p>'], "security-observatory/identity-access.html");\nif (count(identity, identityBoundary) !== 1) errors.push("identity-access.html: expected identity qualification once below hero");\nif (identity.includes("complete retained-data and export-shape validation remains environment-specific")) errors.push("identity-access.html: evidence-register wording returned");`;
  text = replaceExact(text, oldIdentity, newIdentity, 1, "validator identity lead contract");

  text = replaceExact(text, `const documents = htmlByRoute.get("documents/index.html") || "";`, `const entitlements = htmlByRoute.get("security-observatory/entitlements-assets.html") || "";\nrequireAll(entitlements, [\n  '<p class="lead">Review licence usage, broad permissions and governed asset context without automatically removing access or changing commercial assignments.</p>',\n  "Validation against the target release build, environment and user personas remains the boundary for running-user sharing, CRUD and field-level-security claims."\n], "security-observatory/entitlements-assets.html");\nprohibitAll(entitlements, ["Running-user sharing, CRUD and field-level-security behaviour must be validated against the target release build, environment and user personas before being claimed.</p>"], "security-observatory/entitlements-assets.html");\n\nconst documents = htmlByRoute.get("documents/index.html") || "";`, 1, "validator entitlements lead contract");

  text = replaceExact(text, `.hero-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 470px); align-items: center; gap: 3.25rem; padding-block: 3.4rem; }`, `.hero-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 470px); align-items: center; gap: 3.25rem; padding-block: 3.4rem; }`, 0, "noop guard");
  return text;
});

console.log(`Applied overview funnel cleanup to ${changed.length} files:`);
for (const file of changed) console.log(`- ${file}`);
