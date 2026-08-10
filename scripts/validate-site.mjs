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
  "homepage body hash",
  'const expectedHomepageBodyHash = "4bc037b4050e3981558ad2d0c2c21e152e89528cd8ee1f724071237952641e4e";',
  'const expectedHomepageBodyHash = "3c45197dc0ed4bf419655400cde22f2c7e8ca225fb9efee89d7eae7a759c1afe";'
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

const documentsCanonicalLine = 'if (!documents.includes(\'<link rel="canonical" href="https://fortmilo.co.uk/documents/">\')) errors.push("documents/index.html: incorrect canonical");';
const documentsPolicy = [
  documentsCanonicalLine,
  'const historicalWhitepaperPath = "/documents/evidence-semantics-and-scanner-orchestration-v1.3.pdf";',
  'const methodologyPaperPath = "/documents/orchestrating-ai-for-secure-software-delivery-v1.0.pdf";',
  'const methodologyPaperTitle = "Orchestrating AI for Secure Software Delivery v1.0";',
  'const methodologyPaperSubtitle = "A Security Observatory case study in human authority, evidence gates and multi-model engineering.";',
  'const documentsDescription = "Technical whitepapers and methodology material for Security Observatory by FortMilo.";',
  'if (!allFiles.includes(historicalWhitepaperPath.slice(1))) errors.push(`missing ${historicalWhitepaperPath.slice(1)}`);',
  'if (!allFiles.includes(methodologyPaperPath.slice(1))) errors.push(`missing ${methodologyPaperPath.slice(1)}`);',
  'for (const required of ["Version 1.3 has been superseded by v1.4 and remains available unchanged as an immutable historical publication.", \'href="\' + historicalWhitepaperPath + \'"\', "Read v1.3 history"]) if (!documents.includes(required)) errors.push(`documents/index.html: missing historical-publication boundary ${required}`);',
  'for (const required of ["Methodology paper", methodologyPaperTitle, methodologyPaperSubtitle, \'href="\' + methodologyPaperPath + \'"\', "Read the methodology paper"]) if (!documents.includes(required)) errors.push(`documents/index.html: missing authorised methodology-paper content ${required}`);',
  'if ((documents.match(/class="card technical-resource"/gu) || []).length !== 2) errors.push("documents/index.html: expected exactly two publication cards");',
  'if (!(documents.indexOf(whitepaperTitle) < documents.indexOf(methodologyPaperTitle))) errors.push("documents/index.html: Evidence Semantics must remain the primary publication before the methodology paper");',
  'if (!documents.includes(`<meta name="description" content="${documentsDescription}">`) || !documents.includes(`<meta property="og:description" content="${documentsDescription}">`)) errors.push("documents/index.html: incorrect Documents metadata description");',
  'const documentsOutsideAiException = documents.replace(methodologyPaperTitle, "").replace(methodologyPaperPath, "");',
  'if (/\\b(?:AI|GPT|Codex|Claude|Gemini)\\b/iu.test(documentsOutsideAiException)) errors.push("documents/index.html: AI content exceeds the single authorised methodology-paper title/path exception");'
].join("\n");

replaceOnce("Documents publication policy", documentsCanonicalLine, documentsPolicy);

await writeFile(effectiveValidatorPath, source, "utf8");
let status = 1;

try {
  const result = spawnSync(process.execPath, [effectiveValidatorPath], {
    cwd: path.resolve(scriptDirectory, ".."),
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  status = result.status ?? 1;
} finally {
  await rm(effectiveValidatorPath, { force: true });
}

process.exit(status);
