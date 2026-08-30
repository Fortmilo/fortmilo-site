import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PDFDocument } from "pdf-lib";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const source = join(root, "document-src", "evidence-semantics-and-scanner-orchestration.html");
const output = join(root, "documents", "evidence-semantics-and-scanner-orchestration.pdf");

const browserCandidates = [
  process.env.FORTMILO_PDF_BROWSER,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

let browser;
for (const candidate of browserCandidates) {
  try {
    if ((await stat(candidate)).isFile()) {
      browser = candidate;
      break;
    }
  } catch {
    // Try the next supported browser location.
  }
}
if (!browser) throw new Error("No supported Chromium browser found. Set FORTMILO_PDF_BROWSER.");

await mkdir(dirname(output), { recursive: true });
const profile = await mkdtemp(join(tmpdir(), "fortmilo-pdf-"));

try {
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    "--export-tagged-pdf",
    "--generate-pdf-document-outline",
    `--user-data-dir=${profile}`,
    `--print-to-pdf=${output}`,
    pathToFileURL(source).href,
  ];

  await new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(browser, args, { stdio: "inherit", windowsHide: true });
    child.once("error", rejectProcess);
    child.once("exit", (code) => code === 0
      ? resolveProcess()
      : rejectProcess(new Error(`PDF browser exited with code ${code}`)));
  });

  const document = await PDFDocument.load(await readFile(output), { updateMetadata: false });
  document.setTitle("Evidence Semantics and Scanner Orchestration");
  document.setAuthor("Luca Pacini");
  document.setSubject("Security Observatory evidence semantics, scanner planning and bounded licence-assignment retention");
  document.setKeywords([
    "Fortmilo",
    "Security Observatory",
    "Salesforce",
    "evidence semantics",
    "scanner orchestration",
    "licence assignments",
  ]);
  document.setCreator("Fortmilo document generation tooling");
  document.setProducer("Chromium/Skia tagged PDF with pdf-lib metadata post-processing");
  document.setCreationDate(new Date("2026-08-29T00:00:00Z"));
  document.setModificationDate(new Date("2026-08-29T00:00:00Z"));
  await writeFile(output, await document.save({ useObjectStreams: false }));
  console.log(`Generated ${output}`);
} finally {
  await rm(profile, { recursive: true, force: true });
}
