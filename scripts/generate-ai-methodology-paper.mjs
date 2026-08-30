import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PDFBool, PDFDict, PDFDocument, PDFName, PDFString } from "pdf-lib";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const source = join(root, "document-src", "orchestrating-ai-for-secure-software-delivery.html");
const output = join(root, "documents", "orchestrating-ai-for-secure-software-delivery.pdf");
const publicationDate = new Date("2026-08-30T00:00:00Z");

const browserCandidates = [
  process.env.FORTMILO_PDF_BROWSER,
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
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
const profile = await mkdtemp(join(tmpdir(), "fortmilo-ai-methodology-pdf-"));

try {
  const args = [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-gpu-compositing",
    "--disable-dev-shm-usage",
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
  document.setTitle("Orchestrating AI for Secure Software Delivery");
  document.setAuthor("Luca Pacini");
  document.setSubject("Fortmilo engineering methodology for evidence-gated AI-assisted software delivery, using Security Observatory as a bounded case study without attributing AI product capabilities");
  document.setKeywords([
    "Fortmilo",
    "secure software delivery",
    "AI-assisted engineering",
    "human authority",
    "evidence gates",
    "Security Observatory case study",
  ]);
  document.setCreator("Fortmilo document generation tooling");
  document.setProducer("Chromium/Skia tagged PDF with pdf-lib metadata post-processing");
  document.setCreationDate(publicationDate);
  document.setModificationDate(publicationDate);

  const infoReference = document.context.trailerInfo.Info;
  const info = infoReference ? document.context.lookup(infoReference, PDFDict) : null;
  if (!info) throw new Error("PDF information dictionary is missing");
  info.set(PDFName.of("Publisher"), PDFString.of("Fortmilo"));
  info.set(PDFName.of("Version"), PDFString.of("1.0 accessible edition"));
  info.set(PDFName.of("Status"), PDFString.of("Current"));

  document.catalog.set(PDFName.of("Lang"), PDFString.of("en-GB"));
  document.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));
  const viewerPreferences = document.context.obj({ DisplayDocTitle: PDFBool.True });
  document.catalog.set(PDFName.of("ViewerPreferences"), viewerPreferences);
  for (const page of document.getPages()) page.node.set(PDFName.of("Tabs"), PDFName.of("S"));

  const xmp = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/" xmlns:fortmilo="https://fortmilo.co.uk/ns/publication/1.0/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">Orchestrating AI for Secure Software Delivery</rdf:li><rdf:li xml:lang="en-GB">Orchestrating AI for Secure Software Delivery</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>Luca Pacini</rdf:li></rdf:Seq></dc:creator>
      <dc:publisher><rdf:Bag><rdf:li>Fortmilo</rdf:li></rdf:Bag></dc:publisher>
      <dc:language><rdf:Bag><rdf:li>en-GB</rdf:li></rdf:Bag></dc:language>
      <xmp:CreateDate>2026-08-30T00:00:00Z</xmp:CreateDate>
      <xmp:ModifyDate>2026-08-30T00:00:00Z</xmp:ModifyDate>
      <pdf:Producer>Chromium/Skia tagged PDF with pdf-lib metadata post-processing</pdf:Producer>
      <fortmilo:Version>1.0 accessible edition</fortmilo:Version>
      <fortmilo:Status>Current</fortmilo:Status>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  const metadataStream = document.context.flateStream(new TextEncoder().encode(xmp), {
    Type: PDFName.of("Metadata"),
    Subtype: PDFName.of("XML"),
  });
  document.catalog.set(PDFName.of("Metadata"), document.context.register(metadataStream));

  await writeFile(output, await document.save({ useObjectStreams: false }));
  console.log(`Generated accessible publication at ${output}`);
} finally {
  await rm(profile, { recursive: true, force: true });
}
