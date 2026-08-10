import { readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const baseValidatorPath = path.join(scriptDirectory, "validate-site-base.mjs");
const effectiveValidatorPath = path.join(scriptDirectory, ".validate-site-effective.mjs");

let source = await readFile(baseValidatorPath, "utf8");

function replaceOnce(label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one baseline occurrence, found ${count}`);
  source = source.replace(before, after);
}

function replaceAllExact(label, before, after, expectedCount) {
  const count = source.split(before).length - 1;
  if (count !== expectedCount) throw new Error(`${label}: expected ${expectedCount} baseline occurrences, found ${count}`);
  source = source.split(before).join(after);
}

replaceOnce(
  "favicon SVG recorded hash",
  '["favicon.svg", "2dbc5023b718e959c69d27a42558b002b704399fb42d8b6298020fa5df97215c"]',
  '["favicon.svg", "24293f12640b0687bac3edb5e68289ab524a0ae344699244409ec58935bfd06c"]'
);

replaceOnce(
  "reference architecture SVG asset registration",
  '["assets/fortmilo-shield-512.png", "a39acef2c9e9dc76583ed60b4c4c1e59fe92c135a6295683edf080051d0fa980"]',
  '["assets/fortmilo-shield-512.png", "a39acef2c9e9dc76583ed60b4c4c1e59fe92c135a6295683edf080051d0fa980"],\n  ["documents/security-observatory-reference-architecture.svg", "ab068801bb71382624434df8a3e55b6eb728c37baa7f70cecacca87994807636"]'
);

replaceOnce(
  "homepage body hash",
  'const expectedHomepageBodyHash = "4bc037b4050e3981558ad2d0c2c21e152e89528cd8ee1f724071237952641e4e";',
  'const expectedHomepageBodyHash = "44a4641f7cdd3026cbcd202ee7229f20050b094dd921e4eca017eb73bda5295d";'
);

replaceOnce(
  "homepage corporate nav",
  `const homepageCorporateNav = '<nav class="corporate-nav" aria-label="Corporate navigation"><a aria-current="page" href="/">Home</a><a href="/security-observatory/">Security Observatory</a><a href="/architecture-security.html">Architecture & Security</a><a href="/contact.html">Contact</a></nav>';`,
  `const homepageCorporateNav = '<nav class="corporate-nav" aria-label="Corporate navigation"><a aria-current="page" href="/">Home</a><a href="/security-observatory/">Security Observatory</a><a href="/architecture-security.html">Architecture & Security</a><a href="/documents/">Documents</a></nav>';`
);

replaceOnce(
  "homepage evidence-boundary chip",
  'const homepageChips = ["Read-only", "No automatic remediation", "Evidence retained in your org"];',
  'const homepageChips = ["Read-only", "No automatic remediation", "Evidence retained in your org, with user-initiated export as an explicit boundary."];'
);

replaceOnce(
  "homepage retained-evidence differentiator",
  '["Evidence retained inside Salesforce", "Evidence collection, review and retained context remain within the subscriber organisation."],',
  '["Evidence retained inside Salesforce", "Automatic assessment and retained product evidence remain inside the subscriber organisation. A user-initiated sanitised CSV download is a separate export boundary."],'
);
replaceOnce(
  "homepage unavailable-evidence differentiator",
  '["Unavailable evidence stays explicit", "Blocked or incomplete sources remain Not assessed, with a reason and a safe next action. Missing evidence is not converted into zero."],',
  '["Unavailable evidence stays explicit", "Required sources that cannot be assessed remain Unavailable with a bounded reason and safe next action. Selected current zero and unavailable paths have test and controlled runtime evidence; universal environment support is not implied."],'
);
replaceOnce(
  "homepage sanitised-evidence differentiator",
  '["Sanitised evidence by design", "Evidence is presented without tokens, session identifiers, raw IP addresses, secrets, private keys, certificate bodies or credential values."],',
  '["Sanitised evidence by design", "The design excludes tokens, session identifiers, secrets, private keys, certificate bodies and credential values from retained review evidence. Complete raw-IP retained and export-shape validation remains environment-specific."],'
);

replaceOnce(
  "homepage illustrative evidence state",
  `const illustrativePanel = '<aside class="illustrative-evidence" aria-labelledby="illustrative-evidence-label"><p id="illustrative-evidence-label" class="evidence-label">Illustrative evidence state</p><dl><div><dt>State</dt><dd>Not assessed</dd></div><div><dt>Reason</dt><dd>The evidence source was unavailable or incomplete.</dd></div><div><dt>Next safe action</dt><dd>Review access to the required source, then rerun the scan.</dd></div></dl><footer>Illustrative example â€” no organisation data shown.</footer></aside>';`,
  `const illustrativePanel = '<aside class="illustrative-evidence" aria-labelledby="illustrative-evidence-label"><p id="illustrative-evidence-label" class="evidence-label">Illustrative evidence state</p><dl><div><dt>State</dt><dd>Unavailable</dd></div><div><dt>Reason</dt><dd>The required evidence source could not be assessed.</dd></div><div><dt>Next safe action</dt><dd>Review access to the required source, then rerun the scan.</dd></div></dl><footer>Illustrative example â€” no organisation data shown.</footer></aside>';`
);

replaceOnce(
  "Documents-only AI exception",
  '  if (/\\b(?:AI|GPT|Codex|Claude|Gemini)\\b/iu.test(html)) errors.push(`${route.output}: AI reference found`);',
  '  if (route.output !== "documents/index.html" && /\\b(?:AI|GPT|Codex|Claude|Gemini)\\b/iu.test(html)) errors.push(`${route.output}: AI reference found outside the authorised Documents-page exception`);'
);

replaceAllExact(
  "Evidence Semantics path version",
  "evidence-semantics-and-scanner-orchestration-v1.3",
  "evidence-semantics-and-scanner-orchestration-v1.4",
  2
);

replaceAllExact(
  "Evidence Semantics title version",
  "Evidence Semantics and Scanner Orchestration v1.3",
  "Evidence Semantics and Scanner Orchestration v1.4",
  1
);

replaceOnce(
  "homepage current-whitepaper route",
  '<a class="button button-primary" href="/documents/evidence-semantics-and-scanner-orchestration-v1.4.pdf">Read the technical whitepaper</a>',
  '<a class="button button-primary" href="/documents/">Read the current technical whitepaper</a>'
);

replaceOnce(
  "architecture current-whitepaper route",
  'for (const required of ["Technical whitepaper", whitepaperTitle, "Read the technical whitepaper"]) if (!architecture.includes(required)) errors.push(`architecture-security.html: missing ${required}`);\nif (!architecture.includes(`href="${whitepaperPath}"`)) errors.push("architecture-security.html: missing versioned technical whitepaper link");',
  'for (const required of ["Technical whitepaper", "Evidence Semantics and Scanner Orchestration", "Read the current technical whitepaper", "The Documents page identifies the current published version."]) if (!architecture.includes(required)) errors.push(`architecture-security.html: missing ${required}`);\nif (!architecture.includes(\'href="/documents/"\')) errors.push("architecture-security.html: missing current Documents whitepaper route");\nif (architecture.includes(whitepaperPath)) errors.push("architecture-security.html: direct versioned whitepaper link must route through Documents");'
);

const documentsCanonicalLine = 'if (!documents.includes(\';link rel="canonical" href="https://fortmilo.co.uk/documents/">\')) errors.push("documents/index.html: incorrect canonical");';
const documentsPolicy = [
  documentsCanonicalLine,
  'const methodologyPaperPath = "/documents/orchestrating-ai-for-secure-software-delivery-v1.0.pdf";',
  'const methodologyPaperTitle = "Orchestrating AI for Secure Software Delivery v1.0";',
  'const methodologyPaperSubtitle = "A Security Observatory case study in human authority, evidence gates and multi-model engineering.";',
  'const documentsDescription = "Technical whitepapers and methodology material for Security Observatory by FortMilo.";',
  'if (!allFiles.includes(methodologyPaperPath.slice(1))) errors.push(`missing ${methodologyPaperPath.slice(1)}`);',
  'for (const required of ["Methodology paper", methodologyPaperTitle, methodologyPaperSubtitle, \'href="\' + methodologyPaperPath + \'"\', "Read the methodology paper"]) if (!documents.includes(required)) errors.push(`documents/index.html: missing authorised methodology-paper content ${required}`);',
  'if ((documents.match(/class="card technical-resource"/gu) || []).length !== 2) errors.push("documents/index.html: expected exactly two publication cards");',
  'if (!(documents.indexOf(whitepaperTitle) < documents.indexOf(methodologyPaperTitle))) errors.push("documents/index.html: Evidence Semantics must remain the primary publication before the methodology paper");',
  'if (!documents.includes(`<Meta name="description" content="${documentsDescription}">`) || !documents.includes(`<meta property="og:description" content="${documentsDescription}">`)) errors.push("documents/index.html: incorrect Documents metadata description");',
  'const documentsOutsideAiException = documents.replace(methodologyPaperTitle, "").replace(methodologyPaperPath, "");',
  'if (/\\b(?:AI|GPT|Codex|Claude|Gemini)\\b/iu.test(documentsOutsideAiException)) errors.push("documents/index.html: AI content exceeds the single authorised methodology-paper title/path exception");'
].join("\n");

replaceOnce("Documents publication policy", documentsCanonicalLine, documentsPolicy);


replaceOnce(
  "privacy last-updated date",
  `const privacy = htmlByRoute.get("privacy.html") || "";
for (const required of [
  "Last updated:</strong> 8 August 2026",`,
  `const privacy = htmlByRoute.get("privacy.html") || "";
for (const required of [
  "Last updated:</strong> 10 August 2026",`
);

replaceOnce(
  "architecture Tooling state token",
  "\"Not assessed with a bounded reason\", \"limitation and safe next action\"",
  "\"Unavailable â€” bounded reason\", \"limitation and safe next action\", \"Reviewed current paths keep zero distinct\""
");

replaceOnce(
  "architecture evidence branch tokens",
  "\"Can usable evidence\", \"USABLE\", \"EVIDENCE\", \"UNAVAILABLE OR\", \"INCOMPLETE EVIDENCE\", \"NOT ASSESSED\", \"Explicit reason\", \"SAFE NEXT\", \"ACTION\"",
  "\"Can complete usable\", \"USABLE\", \"EVIDENCE\", \"NO COMPLETE\", \"UNAVAILABLE\", \"or PARTIAL + reason\", \"SAFE NEXT\", \"ACTION\""
);

replaceOnce(
  "base evidence vocabulary heading",
  "\"This guide uses distinct vocabulary for outcome, coverage and retained evidence state.\"",
  "\"One canonical rendered vocabulary\""
!;
replaceOnce(
  "base rendered evidence state list",
  "\"<h3>Outcome</h3><ul><li>Risk evidence</li><li>No risk evidence surfaced</li><li>Unknown/Error</li><li>Not applicable</li></ul>\"",
  "\"<h3>Rendered evidence state</h3><ul><li>Contextual metric or finding label</li><li>None found</li><li>Unavailable</li><li>Not assessed</li><li>Not retained at this evidence level</li><li>Not captured</li><li>Not applicable</li></ul>\""
");
replaceOnce(
  "base completeness qualifier list",
  "\"<h3>Retained evidence state</h3><ul><li>Risk evidence</li><li>No risk evidence surfaced</li><li>Unknown/Error</li><li>Not assessed</li></ul>\"",
  "\"<h3>Completeness qualifier</h3><ul><li>Partial</li><li>Shown beside a usable count</li><li>Missing scope identified separately as Not assessed or Unavailable</li></ul>\""
");
replaceOnce(
  "base optional SBS wording",
  "\"Security Observatory works fully without SBS enabled.\"",
  "\"Security Observatory works without SBS enabled.\""
);
replaceOnce(
  "base export section label",
  "\"<p class=\\\"section-label\\">Safe export</p>\"",
  "\"<p class=\\\"section-label\\\">Export controls</p>\""
);
replaceOnce(
  "base formula-trigger heading",
  "\"Formula-injection-safe by default\"",
  "\"Spreadsheet formula-trigger mitigation\""
!;
replaceOnce(
  "base export sensitive-value wording",
  "\"No raw Salesforce IDs, raw queries, stack traces, tokens, session identifiers, raw IP addresses, credentials or certificate bodies.\"",
  "\"The reviewed helper-backed export paths exclude raw Salesforce IDs, raw queries, stack traces, tokens, session identifiers, credentials and certificate bodies.\""
!;
replaceOnce(
  "base none-found boundary",
  "\"No risk evidence surfaced is not a pass.\"",
  "\"None found is not a pass.\""
);

const siteRoot = path.resolve(scriptDirectory, "..");
const evidencePagePath = path.join(siteRoot, "security-observatory", "evidence.html");
const evidencePage = await readFile(evidencePagePath, "utf8");
const evidencePageLower = evidencePage.toLowerCase();
for (const prohibited of [
  "formula-injection-safe",
  "safe export",
  "one export boundary, applied everywhere",
  "No risk evidence surfaced",
  "Unknown/Error"
]) {
  if (evidencePageLower.includes(prohibited.toLowerCase())) throw new Error(`security-observatory/evidence.html: prohibited public wording ${prohibited}`);
}
for (const required of [
  "None found",
  "Unavailable",
  "Not assessed",
  "Not retained at this evidence level",
  "Not captured",
  "Not applicable",
  "Release-status boundary",
  "A detained state is the point-in-time rendered state stored with a scan.",
  "Spreadsheet formula-trigger mitigation",
  "Each surface exports a fixed allow-list",
  "This applies to the reviewed export helper paths and the enumerated trigger characters.",
  "It is not a claim that every spreadsheet-injection technique or every export path is covered.",
  "Raw-IP omission or redaction is a design boundary whose complete retained-data and export-shape validation remains environment-specific"
]) {
  if (!evidencePage.includes(required)) throw new Error(`security-observatory/evidence.html: missing bounded evidence wording ${required}`);
}
if (!(evidencePage.indexOf("What a result does not mean") < evidencePage.indexOf("Current v1 SBS mapping"))) {
  throw new Error("security-observatory/evidence.html: conclusion-boundary block must precede SBS mapping statistics");
}

const homepage = await readFile(path.join(siteRoot, "index.html"), "utf8");
for (const required of [
  "<dt>State</dt><dd>Unavailable</dd>",
  "The required evidence source could not be assessed.",
  "Evidence retained in your org, with user-initiated export as an explicit boundary.",
  "A user-initiated sanitised CSV download is a separate export boundary.",
  'href="/documents/">Read the current technical whitepaper</a>',
  "Complete raw-IP retained and export-shape validation remains environment-specific."
]) {
  if (!homepage.includes(required)) throw new Error(`index.html: missing evidence-boundary wording ${required}`);
}
for (const prohibited of ["<dt>State</dt><dd>Not assessed</dd>", "No risk evidence surfaced", "Unknown/Error", "/documents/evidence-semantics-and-scanner-orchestration-v1.4.pdf"]) {
  if (homepage.includes(prohibited)) throw new Error(`index.html: prohibited evidence-state or stale whitepaper wording ${prohibited}`);
}

const architecture = await readFile(path.join(siteRoot, "architecture-security.html"), "utf8");
for (const required of [
  "Unavailable â€” ›İ[™Y™X\ÛÛˆ‹ˆ”™]šY]ÙYİ\œ™[]ÈÙY\™\›È\İ[˜İ‹ˆ“™Z]\ˆ[˜]˜Z[X›H›Üˆ\X[\ÈHİXœİ]]H›Üˆ›Û™H›İ[™‹ˆ™^XİXØ[™Y]H\œÛÛ˜H˜[Y][Ûˆ‹ˆ	Ú™YH‹ÙØİ[Y[ËÈ”™XYHİ\œ™[XÚšXØ[Ú]\\\ØO‰ÂˆJHÂˆYˆ
X\˜Ú]Xİ\™Kš[˜ÛY\Ê™\]Z\™Y
JH›İÈ™]È\œ›ÜŠ\˜Ú]Xİ\™K\ÙXİ\š]Kš[ˆZ\ÜÚ[™È›İ[™Y]šY[˜ÙHÛÜ™[™È	Ü™\]Z\™YX
NÂŸB™›Üˆ
ÛÛœİ›ÚXš]YÙˆÈ“›İ\ÜÙ\ÜÙYÚ]H›İ[™Y™X\ÛÛˆ‹•SURSP“HÔİ^^WŒŒˆOWŒÎW’SÓÓTUHU’QSÑOİ^^WM×ˆOWŒÍŒ—““ÕTÔÑTÔÑQ‹‹ÙØİ[Y[ËÙ]šY[˜ÙK\Ù[X[XÜËX[™\ØØ[›™\‹[Ü˜Ú\İ˜][Û‹]ŒKœˆ—JHÂˆYˆ
\˜Ú]Xİ\™Kš[˜ÛY\Ê›ÚXš]Y
JH›İÈ™]È\œ›ÜŠ\˜Ú]Xİ\™K\ÙXİ\š]Kš[ˆØœÛÛ]Hİ]HÜˆİ[HÚ]\\\ˆX\[™È	Ü›ÚXš]YX
NÂŸB‚˜ÛÛœİš[™[™ÜÈH]ØZ]™XYš[J]š›Ú[ŠÚ]T›ÛİœÙXİ\š]K[ØœÙ\˜]ÜH‹™š[™[™ÜËš[ŠK]ŠNÂ™›Üˆ
ÛÛœİ›ÚXš]YÙˆÈ“›Èš\ÚÈ]šY[˜ÙHİ\™˜XÙY‹•[šÛ›İÛ‹Ñ\œ›Üˆ—JHÂˆYˆ
š[™[™ÜËš[˜ÛY\Ê›ÚXš]Y
JH›İÈ™]È\œ›ÜŠÙXİ\š]K[ØœÙ\˜]ÜKÙš[™[™ÜËš[ˆØœÛÛ]H]šY[˜ÙHÚÙ[ˆ	Ü›ÚXš]YX
NÂŸB™›Üˆ
ÛÛœİ™\]Z\™YÙˆÈ“›Û™H›İ[™‹•[˜]˜Z[X›H‹“›İ™]Z[™Y]\È]šY[˜ÙH]™[‹“›İØ\\™Y—JHÂˆYˆ
Yš[™[™ÜËš[˜ÛY\Ê™\]Z\™Y
JH›İÈ™]È\œ›ÜŠÙXİ\š]K[ØœÙ\˜]ÜKÙš[™[™ÜËš[ˆZ\ÜÚ[™ÈØ[›ÛšXØ[]šY[˜ÙHÚÙ[ˆ	Ü™\]Z\™YX
NÂŸB‚˜ÛÛœİ[][Y[ÈH]ØZ]™XYš[J]š›Ú[ŠÚ]T›ÛİœÙXİ\š]K[ØœÙ\˜]ÜH‹™[][Y[ËX\ÜÙ]Ëš[ŠK]ŠNÂšYˆ
[][Y[Ëš[˜ÛY\Ê‘“ËYØ]YÛÛ›ÛÈŠJH›İÈ™]È\œ›ÜŠœÙXİ\š]K[ØœÙ\˜]ÜKÙ[][Y[ËX\ÜÙ]Ëš[ˆ[˜[Y]Y“ËYØ]Y[\[Y[][ÛˆÛZ[H™]\›™YŠNÂšYˆ
Y[][Y[Ëš[˜ÛY\Ê™^XİXØ[™Y]H\œÛÛ˜H˜[Y][ÛˆŠJH›İÈ™]È\œ›ÜŠœÙXİ\š]K[ØœÙ\˜]ÜKÙ[][Y[ËX\ÜÙ]Ëš[ˆZ\ÜÚ[™È\œÛÛ˜K]˜[Y][Ûˆ›İ[™\HŠNÂ‚˜ÛÛœİY[]HH]ØZ]™XYš[J]š›Ú[ŠÚ]T›ÛİœÙXİ\š]K[ØœÙ\˜]ÜH‹šY[]KXXØÙ\ÜËš[ŠK]ŠNÂšYˆ
Y[]Kš[˜ÛY\ÊÚ]İ]Ù\ÜÚ[ÛˆQÈÜˆ˜]ÈT˜[Y\ÈŠJH›İÈ™]È\œ›ÜŠœÙXİ\š]K[ØœÙ\˜]ÜKÚY[]KXXØÙ\ÜËš[ˆ[š]™\œØ[˜]ËRT^Û\Ú[ÛˆÛZ[H™]\›™YŠNÂ˜ÛÛœİY[]T˜]Ò\ÛÜHH”˜]ÈT˜[Y\È\™HÛZ]YÜˆ™YXİYÈ^Xİ™]Z[™YY]HÚ\H\È˜[Y]Y\ˆ[š\›Û›Y[ˆÂšYˆ

Y[]KœÜ]
Y[]T˜]Ò\ÛÜJK›[™İHJHOOHŠH›İÈ™]È\œ›ÜŠœÙXİ\š]K[ØœÙ\˜]ÜKÚY[]KXXØÙ\ÜËš[ˆ^XİYİ\İÛY\‹Y˜XÚ[™È˜]ËRT›İ[™\H[ˆ[›È[™Ù\ÜÚ[ÛœÈØ\™ŠNÂšYˆ
Y[]Kš[˜ÛY\Ê”˜]ËRTÛZ\ÜÚ[ÛˆÜˆ™YXİ[Ûˆ\ÈH\ÚYÛˆ›İ[™\HÚÜÙHÛÛ\]H™]Z[™YY]H[™^Ü\Ú\H˜[Y][Ûˆ™[XZ[œÈ[š\›Û›Y[\ÜXÚYšXÈŠJH›İÈ™]È\œ›ÜŠœÙXİ\š]K[ØœÙ\˜]ÜKÚY[]KXXØÙ\ÜËš[ˆ[\›˜[]šY[˜ÙK\™YÚ\İ\ˆ˜]ËRTÛÜ™[™È™]\›™YŠNÂ‚˜]ØZ]Üš]Qš[JY™™Xİ]™U˜[Y]Ü”]Ûİ\˜ÙK]ŠNÂ›]İ]\ÈHNÂ‚HÂˆÛÛœİ™\İ[HÜ]Û”Ş[˜Ê›ØÙ\ÜË™^XÔ]ÙY™™Xİ]™U˜[Y]Ü”]KÂˆİÙˆÚ]T›Ûİˆİ[Îˆš[š\š]‚ˆJNÂˆYˆ
™\İ[™\œ›ÜŠH›İÈ™\İ[™\œ›ÜÂˆİ]\ÈH™\İ[œİ]\ÈÏÈNÂŸHš[˜[HÂˆ]ØZ]›JY™™Xİ]™U˜[Y]Ü”]È›Ü˜ÙNˆYHJNÂŸB‚œ›ØÙ\ÜË™^]
İ]\ÊNÂ