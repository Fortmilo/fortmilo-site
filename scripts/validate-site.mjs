import { createHash } from "node:crypto";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { routes } from "../site-src/site-map.mjs";
import { previewImageAlt, previewImagePath, previewImageUrl } from "../site-src/templates.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".ico", ".svg"]);

const expectedImages = new Map([
  ["apple-touch-icon.png", "b0d934915f33b3431f68781f6443d3057c50e614012de0acc7b5e841c142856a"],
  ["favicon-16x16.png", "6b754e63f6a325bca39f6d58e4e4123542c59820bb1749b7833083ead72c3acf"],
  ["favicon-32x32.png", "8ba07be74b5a7cfbf5f23467376c0078bd32f6eb3a59ce7b0e098ce4a5e90029"],
  ["favicon-48x48.png", "0a924eab674dbb5db3f65cd896603cee3aa917acb501b752a4ec40987b4550a8"],
  ["favicon.ico", "bd2f5e21de591691571aaa2bd8b71a251fdb4edb540c2ce27a3ad14a300e537c"],
  ["favicon.svg", "24293f12640b0687bac3edb5e68289ab524a0ae344699244409ec58935bfd06c"],
  ["mstile-150x150.png", "4417d9367cad3ab2e9949d1bca38646115ef9bea3db4c8976b48752963d5929f"],
  ["assets/android-chrome-192x192.png", "5af19460703089a8ff214413844aeafeb62920529b13ced37315dd56ccdf9661"],
  ["assets/android-chrome-512x512.png", "c194e9a1687190110b2bce2e2ceeefac97bb5c8ff050df53a9e0197c601502a8"],
  ["assets/fortmilo-brand-banner-1200x675.png", "f01e55a44b8bdf309c41c4899a7917dd1982c1845d8a9c295bf0d8788e10fc13"],
  ["assets/fortmilo-security-observatory-og-20260731.jpg", "e94aac3a839cf32183d1598d461db89724622612ea5299afcc00b1b9bccd8fd9"],
  ["assets/fortmilo-shield-512.png", "a39acef2c9e9dc76583ed60b4c4c1e59fe92c135a6295683edf080051d0fa980"]
]);

const pngDimensions = new Map([
  ["apple-touch-icon.png", [180, 180]],
  ["favicon-16x16.png", [16, 16]],
  ["favicon-32x32.png", [32, 32]],
  ["favicon-48x48.png", [48, 48]],
  ["mstile-150x150.png", [150, 150]],
  ["assets/android-chrome-192x192.png", [192, 192]],
  ["assets/android-chrome-512x512.png", [512, 512]],
  ["assets/fortmilo-brand-banner-1200x675.png", [1200, 675]],
  ["assets/fortmilo-shield-512.png", [512, 512]]
]);

const requiredIconMetadata = [
  '<link rel="icon" href="/favicon.ico" sizes="any">',
  '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
  '<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">',
  '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
  '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">',
  '<link rel="manifest" href="/site.webmanifest">',
  '<meta name="msapplication-TileColor" content="#07101d">',
  '<meta name="msapplication-TileImage" content="/mstile-150x150.png">'
];

const requiredSocialMetadata = [
  `<meta property="og:image" content="${previewImageUrl}">`,
  '<meta property="og:image:type" content="image/jpeg">',
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  `<meta property="og:image:alt" content="${previewImageAlt}">`,
  '<meta name="twitter:card" content="summary_large_image">',
  `<meta name="twitter:image" content="${previewImageUrl}">`,
  `<meta name="twitter:image:alt" content="${previewImageAlt}">`
];

const staleAssetTokens = [
  ["fortmilo-logo", ".svg"].join(""),
  ["fortmilo-security-observatory-og-20260730", ".jpg"].join(""),
  ["fortmilo-security-observatory-og-v2", ".png"].join(""),
  ["fortmilo-security-observatory-og", ".png"].join(""),
  ["security-observatory-navigation", ".png"].join(""),
  ["assets/favicon-", "192.png"].join(""),
  ["assets/favicon-", "512.png"].join(""),
  ["assets/apple-touch-", "icon.png"].join(""),
  ["assets/favicon-", "32.png"].join(""),
  ["fortmilo-brand-banner-1200x675", ".jpg"].join("")
];
const directGovernanceUnixPath = ["assets", "approved", ""].join("/");
const directGovernanceWindowsPath = ["assets", "approved", ""].join("\\");
const directMasterPattern = new RegExp(["-master", "\\.(?:png|jpe?g|svg)"].join(""), "iu");

const crcTable = new Uint32Array(256);
for (let value = 0; value < 256; value += 1) {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  crcTable[value] = crc >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function parsePng(buffer, label) {
  if (buffer.length < 45 || !buffer.subarray(0, 8).equals(pngSignature)) throw new Error(`${label}: invalid PNG signature`);
  let offset = 8;
  let ihdr;
  const idat = [];
  let sawEnd = false;
  let chunkIndex = 0;
  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) throw new Error(`${label}: truncated PNG chunk`);
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > buffer.length) throw new Error(`${label}: invalid ${type} chunk length`);
    const storedCrc = buffer.readUInt32BE(offset + 8 + length);
    const calculatedCrc = crc32(buffer.subarray(offset + 4, offset + 8 + length));
    if (storedCrc !== calculatedCrc) throw new Error(`${label}: invalid ${type} CRC`);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (chunkIndex === 0 && type !== "IHDR") throw new Error(`${label}: IHDR must be the first PNG chunk`);
    if (type === "IHDR") {
      if (ihdr || length !== 13) throw new Error(`${label}: invalid PNG IHDR`);
      ihdr = data;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      if (length !== 0) throw new Error(`${label}: invalid PNG IEND`);
      sawEnd = true;
      offset = end;
      break;
    }
    chunkIndex += 1;
    offset = end;
  }
  if (!ihdr || !idat.length || !sawEnd || offset !== buffer.length) throw new Error(`${label}: incomplete PNG structure`);
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colourType = ihdr[9];
  const compression = ihdr[10];
  const filterMethod = ihdr[11];
  const interlace = ihdr[12];
  if (!width || !height) throw new Error(`${label}: invalid PNG dimensions`);
  if (bitDepth !== 8 || ![2, 6].includes(colourType)) throw new Error(`${label}: expected 8-bit RGB or RGBA PNG`);
  if (compression !== 0 || filterMethod !== 0 || interlace !== 0) throw new Error(`${label}: unsupported or interlaced PNG`);
  const channels = colourType === 6 ? 4 : 3;
  const rowBytes = width * channels;
  let inflated;
  try {
    inflated = inflateSync(Buffer.concat(idat));
  } catch (error) {
    throw new Error(`${label}: PNG decompression failed (${error.message})`);
  }
  if (inflated.length !== height * (rowBytes + 1)) throw new Error(`${label}: wrong PNG decompressed length`);
  const rgba = Buffer.alloc(width * height * 4);
  let sourceOffset = 0;
  let pixelOffset = 0;
  let previous = Buffer.alloc(rowBytes);
  let minimumAlpha = 255;
  for (let row = 0; row < height; row += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    if (filter > 4) throw new Error(`${label}: invalid PNG row filter`);
    const current = Buffer.alloc(rowBytes);
    for (let column = 0; column < rowBytes; column += 1) {
      const encoded = inflated[sourceOffset];
      sourceOffset += 1;
      const left = column >= channels ? current[column - channels] : 0;
      const above = previous[column];
      const upperLeft = column >= channels ? previous[column - channels] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) : paeth(left, above, upperLeft);
      current[column] = (encoded + predictor) & 0xff;
    }
    for (let column = 0; column < width; column += 1) {
      const sourcePixel = column * channels;
      rgba[pixelOffset] = current[sourcePixel];
      rgba[pixelOffset + 1] = current[sourcePixel + 1];
      rgba[pixelOffset + 2] = current[sourcePixel + 2];
      const alpha = channels === 4 ? current[sourcePixel + 3] : 255;
      rgba[pixelOffset + 3] = alpha;
      if (alpha < minimumAlpha) minimumAlpha = alpha;
      pixelOffset += 4;
    }
    previous = current;
  }
  return { width, height, bitDepth, colourType, interlace, rgba, actualTransparency: minimumAlpha < 255 };
}

function parseJpeg(buffer, label) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error(`${label}: invalid JPEG signature`);
  let offset = 2;
  let frame;
  let sawScan = false;
  let sawEnd = false;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) throw new Error(`${label}: invalid JPEG marker at ${offset}`);
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) break;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd9) {
      sawEnd = true;
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) throw new Error(`${label}: truncated JPEG segment`);
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) throw new Error(`${label}: invalid JPEG segment length`);
    if ((marker >= 0xc0 && marker <= 0xcf) && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (length < 8) throw new Error(`${label}: invalid JPEG frame header`);
      frame = {
        marker,
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
        components: buffer[offset + 7]
      };
    }
    if (marker === 0xda) {
      sawScan = true;
      offset += length;
      let scanOffset = offset;
      while (scanOffset < buffer.length - 1) {
        if (buffer[scanOffset] !== 0xff) {
          scanOffset += 1;
          continue;
        }
        let markerOffset = scanOffset + 1;
        while (markerOffset < buffer.length && buffer[markerOffset] === 0xff) markerOffset += 1;
        if (markerOffset >= buffer.length) throw new Error(`${label}: truncated JPEG entropy data`);
        const scanMarker = buffer[markerOffset];
        if (scanMarker === 0x00 || (scanMarker >= 0xd0 && scanMarker <= 0xd7)) {
          scanOffset = markerOffset + 1;
          continue;
        }
        offset = scanOffset;
        break;
      }
      if (scanOffset >= buffer.length - 1) throw new Error(`${label}: missing JPEG EOI`);
    } else {
      offset += length;
    }
  }
  if (!frame || frame.marker !== 0xc0) throw new Error(`${label}: expected baseline/non-progressive JPEG SOF0`);
  if (!sawScan || !sawEnd) throw new Error(`${label}: incomplete JPEG structure`);
  if (offset !== buffer.length) throw new Error(`${label}: trailing bytes after JPEG EOI`);
  return frame;
}

function parseIco(buffer, label) {
  if (buffer.length < 6 || buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) throw new Error(`${label}: invalid ICO header`);
  const count = buffer.readUInt16LE(4);
  if (count !== 3 || buffer.length < 6 + (count * 16)) throw new Error(`${label}: expected exactly three ICO entries`);
  const sizes = new Set();
  for (let index = 0; index < count; index += 1) {
    const entryOffset = 6 + (index * 16);
    const width = buffer[entryOffset] || 256;
    const height = buffer[entryOffset + 1] || 256;
    const resourceLength = buffer.readUInt32LE(entryOffset + 8);
    const resourceOffset = buffer.readUInt32LE(entryOffset + 12);
    if (!resourceLength || resourceOffset + resourceLength > buffer.length) throw new Error(`${label}: invalid ${width}x${height} ICO entry`);
    const image = buffer.subarray(resourceOffset, resourceOffset + resourceLength);
    const parsed = parsePng(image, `${label} ${width}x${height}`);
    if (parsed.width !== width || parsed.height !== height) throw new Error(`${label}: ${width}x${height} directory entry does not match its PNG`);
    sizes.add(`${width}x${height}`);
  }
  for (const required of ["16x16", "32x32", "48x48"]) if (!sizes.has(required)) throw new Error(`${label}: missing ${required} entry`);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function listFiles(directory, relative = "") {
  const files = [];
  for (const name of await readdir(directory)) {
    if (name === ".git") continue;
    const full = path.join(directory, name);
    const rel = path.posix.join(relative, name);
    const info = await stat(full);
    if (info.isDirectory()) files.push(...await listFiles(full, rel));
    else files.push(rel);
  }
  return files;
}

async function readRequired(relativePath) {
  try {
    return await readFile(path.join(root, relativePath));
  } catch {
    errors.push(`missing ${relativePath}`);
    return null;
  }
}

function contrastRatio(first, second) {
  const luminance = (hex) => {
    const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
  };
  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (light + 0.05) / (dark + 0.05);
}

const allFiles = await listFiles(root);
const actualImages = allFiles.filter((file) => imageExtensions.has(path.extname(file).toLowerCase())).sort();
const expectedImageNames = [...expectedImages.keys()].sort();
for (const file of actualImages) if (!expectedImages.has(file)) errors.push(`unexpected or superseded public image ${file}`);
for (const file of expectedImageNames) if (!actualImages.includes(file)) errors.push(`missing approved public image ${file}`);

const parsedPngs = new Map();
for (const [relativePath, expectedHash] of expectedImages) {
  const buffer = await readRequired(relativePath);
  if (!buffer) continue;
  if (sha256(buffer) !== expectedHash) errors.push(`${relativePath}: bytes differ from the approved or recorded derivative`);
  if (path.extname(relativePath).toLowerCase() === ".png") {
    try {
      const png = parsePng(buffer, relativePath);
      parsedPngs.set(relativePath, png);
      const expected = pngDimensions.get(relativePath);
      if (!expected || png.width !== expected[0] || png.height !== expected[1]) errors.push(`${relativePath}: wrong PNG dimensions`);
      if (png.actualTransparency) errors.push(`${relativePath}: unexpected transparent pixels`);
    } catch (error) {
      errors.push(error.message);
    }
  }
}

const preview = await readRequired(previewImagePath.slice(1));
if (preview) {
  try {
    const jpeg = parseJpeg(preview, previewImagePath);
    if (jpeg.width !== 1200 || jpeg.height !== 630) errors.push(`${previewImagePath}: expected 1200x630 JPEG`);
    if (jpeg.components !== 3) errors.push(`${previewImagePath}: expected three JPEG colour components`);
    if (preview.length >= 500000) errors.push(`${previewImagePath}: expected file size below 500 KB`);
  } catch (error) {
    errors.push(error.message);
  }
}

const ico = await readRequired("favicon.ico");
if (ico) {
  try {
    parseIco(ico, "favicon.ico");
  } catch (error) {
    errors.push(error.message);
  }
}

const svg = await readRequired("favicon.svg");
if (svg && !/^(?:\uFEFF)?\s*(?:<\?xml\b[^?]*\?>\s*)?<svg(?:\s|>)/u.test(svg.toString("utf8"))) {
  errors.push("favicon.svg: expected valid SVG/XML content at the start of the file");
}

const htmlByRoute = new Map();
for (const route of routes) {
  const buffer = await readRequired(route.output);
  if (!buffer) continue;
  const html = buffer.toString("utf8");
  htmlByRoute.set(route.output, html);
  if ((html.match(/<h1\b/gu) || []).length !== 1) errors.push(`${route.output}: expected one h1`);
  for (const required of ["<title>", 'name="description"', 'property="og:title"', 'property="og:description"', 'property="og:url"', 'rel="stylesheet"']) {
    if (!html.includes(required)) errors.push(`${route.output}: missing ${required}`);
  }
  if (route.noindex) {
    if (!html.includes('<meta name="robots" content="noindex">')) errors.push(`${route.output}: missing noindex`);
    if (html.includes('rel="canonical"')) errors.push(`${route.output}: 404 must not contain a canonical link`);
  } else if (!html.includes(`<link rel="canonical" href="${route.canonical}">`)) {
    errors.push(`${route.output}: missing normal-page canonical`);
  }
  for (const metadata of [...requiredIconMetadata, ...requiredSocialMetadata]) if (!html.includes(metadata)) errors.push(`${route.output}: missing ${metadata}`);
  if ((html.match(/\/favicon\.svg/gu) || []).length !== 1) errors.push(`${route.output}: expected exactly one /favicon.svg reference`);
  const headerLogo = '<img src="/assets/fortmilo-shield-512.png" alt="" width="512" height="512"><span>FortMilo</span>';
  if (!html.includes(headerLogo)) errors.push(`${route.output}: missing approved compact header logo or intrinsic dimensions`);
  if ((html.match(/\/assets\/fortmilo-shield-512\.png/gu) || []).length !== 1) errors.push(`${route.output}: expected one compact header-logo reference`);
  const bannerCount = (html.match(/\/assets\/fortmilo-brand-banner-1200x675\.png/gu) || []).length;
  if (bannerCount !== 0) errors.push(`${route.output}: obsolete primary banner found`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/gu)].map((match) => match[1]);
  if (new Set(ids).size !== ids.length) errors.push(`${route.output}: duplicate id`);
  if (/<script\b/iu.test(html) || /gtag|google-analytics|plausible|matomo/iu.test(html)) errors.push(`${route.output}: analytics, tracking or executable script found`);
  if (/\b(?:AI|GPT|Codex|Claude|Gemini)\b/iu.test(html)) errors.push(`${route.output}: AI reference found`);
  if (/Salesforce Partner|AppExchange|approved by Salesforce|(?<!not )endorsed by Salesforce/iu.test(html)) errors.push(`${route.output}: prohibited Salesforce relationship claim`);
  if (/href="https:\/\/github\.com\/Fortmilo\//iu.test(html)) errors.push(`${route.output}: prohibited GitHub repository link`);
  if (/FortMilo Lab|individual applicant|pending-address|business-address confirmation|actual application terminology|where supported/iu.test(html)) errors.push(`${route.output}: stale identity, address or terminology wording`);
  if (!html.includes("Luca Pacini, trading as FortMilo.") || !html.includes("Independent of and not endorsed by Salesforce, Inc. Salesforce is a trademark of Salesforce, Inc.")) errors.push(`${route.output}: incomplete approved footer identity or disclaimer`);
  const ogImages = [...html.matchAll(/<meta property="og:image" content="([^"]+)">/gu)].map((match) => match[1]);
  const twitterImages = [...html.matchAll(/<meta name="twitter:image" content="([^"]+)">/gu)].map((match) => match[1]);
  if (ogImages.length !== 1 || twitterImages.length !== 1 || ogImages[0] !== previewImageUrl || twitterImages[0] !== previewImageUrl) errors.push(`${route.output}: incomplete or mismatched social-image metadata`);
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/gu)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|#)/u.test(target)) continue;
    const clean = target.split(/[?#]/u)[0];
    const resolved = clean.startsWith("/") ? path.join(root, clean) : path.resolve(path.dirname(path.join(root, route.output)), clean);
    const candidate = clean.endsWith("/") ? path.join(resolved, "index.html") : resolved;
    try {
      await access(candidate);
    } catch {
      errors.push(`${route.output}: broken local reference ${target}`);
    }
  }
}

const textFiles = allFiles.filter((file) => [".html", ".css", ".mjs", ".js", ".json", ".xml", ".md", ".txt", ".ps1", ".webmanifest"].includes(path.extname(file).toLowerCase()) || path.basename(file) === "site.webmanifest");
for (const relativePath of textFiles) {
  const text = await readFile(path.join(root, relativePath), "utf8");
  for (const token of staleAssetTokens) if (text.includes(token)) errors.push(`${relativePath}: stale asset reference ${token}`);
  if (text.includes(directGovernanceUnixPath) || text.includes(directGovernanceWindowsPath) || directMasterPattern.test(text)) errors.push(`${relativePath}: direct governance-master path`);
}

const manifestBuffer = await readRequired("site.webmanifest");
if (manifestBuffer) {
  try {
    const manifest = JSON.parse(manifestBuffer.toString("utf8"));
    if (manifest.background_color !== "#07101d" || manifest.theme_color !== "#07101d") errors.push("site.webmanifest: incorrect theme or background colour");
    const expectedManifestIcons = [
      ["/assets/android-chrome-192x192.png", "192x192"],
      ["/assets/android-chrome-512x512.png", "512x512"]
    ];
    if (!Array.isArray(manifest.icons) || manifest.icons.length !== 2) errors.push("site.webmanifest: expected exactly two approved PWA icons");
    else for (let index = 0; index < expectedManifestIcons.length; index += 1) {
      const icon = manifest.icons[index];
      const [src, sizes] = expectedManifestIcons[index];
      if (icon.src !== src || icon.sizes !== sizes || icon.type !== "image/png") errors.push(`site.webmanifest: icon ${index + 1} does not match approved path, size and MIME type`);
    }
  } catch (error) {
    errors.push(`site.webmanifest: invalid JSON (${error.message})`);
  }
}

const contact = htmlByRoute.get("contact.html") || "";
for (const required of ["Contact FortMilo.", "Luca Pacini", "Luca Pacini, trading as FortMilo", "Harpenden, Hertfordshire, United Kingdom", "info@fortmilo.co.uk", "https://fortmilo.co.uk/", "https://fortmilo.co.uk/security-observatory/", "/.well-known/security.txt"]) if (!contact.includes(required)) errors.push(`contact.html: missing ${required}`);
if (!contact.includes("contact-grid") || (contact.match(/class="contact-card"/gu) || []).length !== 2) errors.push("contact.html: missing balanced two-column contact layout");

const homepage = htmlByRoute.get("index.html") || "";
const homepageDescription = "Security Observatory organises read-only Salesforce security evidence for OAuth grants, privileged access, external exposure and evidence gaps.";
for (const required of [
  "Salesforce security evidence collected and retained inside your org.",
  "Bring OAuth grants, privileged access, external exposure and evidence gaps into one review surface, with reasons and safe next actions kept explicit.",
  "Illustrative evidence state", "State", "Not assessed", "The evidence source was unavailable or incomplete.", "Next safe action",
  "Review access to the required source, then rerun the scan.", "Illustrative example — no organisation data shown.",
  "Evidence designed for Salesforce security review", "References control identifiers from the independent",
  "Security Benchmark for Salesforce (SBS)", "CC BY-SA 4.0", homepageDescription,
  "Read-only by design", "Reports evidence and limitations without revoking tokens, removing permissions, blocking APIs, changing endpoints or writing security changes back to Salesforce.",
  "Evidence retained inside Salesforce", "Evidence collection, review and retained context remain within the subscriber organisation.",
  "Unavailable evidence stays explicit", "Blocked or incomplete sources remain Not assessed, with a reason and a safe next action. Missing evidence is not converted into zero.",
  "Sanitised evidence by design", "Evidence is presented without tokens, session identifiers, raw IP addresses, secrets, private keys, certificate bodies or credential values.",
  "Prioritise access and exposure", "Focus review on OAuth grants, privileged access and externally exposed surfaces, with affected users, applications or assets shown where retained evidence supports it."
]) if (!homepage.includes(required)) errors.push(`index.html: missing homepage contract text ${required}`);
for (const forbidden of ["Read-only security evidence for Salesforce.", "Security Observatory by FortMilo", "hero-brand-art", "What happened"]) if (homepage.includes(forbidden)) errors.push(`index.html: obsolete homepage content ${forbidden}`);
for (const chip of ["Read-only", "No automatic remediation", "Evidence retained in your org"]) if (!homepage.includes(`<li>${chip}</li>`)) errors.push(`index.html: missing approved chip ${chip}`);
const heroChips = /<ul class="hero-chips"[^>]*>([\s\S]*?)<\/ul>/u.exec(homepage)?.[1] || "";
if ((homepage.match(/class="hero-chips"/gu) || []).length !== 1 || (heroChips.match(/<li>/gu) || []).length !== 3 || (heroChips.match(/<li>(?:Read-only|No automatic remediation|Evidence retained in your org)<\/li>/gu) || []).length !== 3) errors.push("index.html: expected exactly three approved chips");
if ((homepage.match(/class="card differentiator-card"/gu) || []).length !== 5) errors.push("index.html: expected exactly five differentiator cards");
if (!homepage.includes('<aside class="illustrative-evidence"') || !homepage.includes("<dl>")) errors.push("index.html: evidence panel must use aside and dl semantics");
if (!homepage.includes('href="https://www.securitybenchmark.org/"') || !homepage.includes('href="https://creativecommons.org/licenses/by-sa/4.0/"')) errors.push("index.html: missing SBS attribution links");
if (!homepage.includes('<meta name="description" content="' + homepageDescription + '">') || !homepage.includes('<meta property="og:description" content="' + homepageDescription + '">')) errors.push("index.html: incorrect homepage descriptions");
if (!homepage.includes("<title>FortMilo | Security Observatory</title>") || !homepage.includes('<a class="button button-primary" href="/security-observatory/">Explore Security Observatory</a>') || !homepage.includes('<a class="button button-secondary" href="/contact.html">Contact</a>')) errors.push("index.html: incorrect title or homepage actions");

const terms = htmlByRoute.get("terms.html") || "";
for (const required of [
  "Last updated:</strong> 1 August 2026",
  "Luca Pacini, trading as FortMilo",
  "Apache License 2.0",
  "Creative Commons Attribution-ShareAlike 4.0 International",
  "No Security Benchmark for Salesforce control prose is reproduced",
  "law of England and Wales",
  "courts of England and Wales have exclusive jurisdiction"
]) if (!terms.includes(required)) errors.push(`terms.html: missing required clause ${required}`);
for (const forbidden of ["Limitation of liability", "£100", "fees paid", "aggregate liability", "relevant service", "monetary liability"]) if (terms.includes(forbidden)) errors.push(`terms.html: stale liability wording ${forbidden}`);

const privacy = htmlByRoute.get("privacy.html") || "";
for (const required of [
  "Last updated:</strong> 31 July 2026",
  "Controller:</strong> Luca Pacini, trading as FortMilo",
  "Harpenden, Hertfordshire, United Kingdom",
  "12 months after the enquiry closes",
  "IP address",
  "website hosting, email delivery and storage",
  "outside the United Kingdom",
  "right to object to processing based on legitimate interests",
  "Information Commissioner’s Office"
]) if (!privacy.includes(required)) errors.push(`privacy.html: missing required privacy wording ${required}`);

const securityText = await readRequired(".well-known/security.txt");
if (securityText) {
  const normalised = securityText.toString("utf8").replace(/\r\n?/gu, "\n").trimEnd();
  const expected = [
    "Contact: mailto:info@fortmilo.co.uk",
    "Expires: 2027-07-31T23:59:59Z",
    "Preferred-Languages: en",
    "Canonical: https://fortmilo.co.uk/.well-known/security.txt"
  ].join("\n");
  if (normalised !== expected) errors.push(".well-known/security.txt: invalid RFC 9116 field set or values");
  if (Number.isNaN(Date.parse("2027-07-31T23:59:59Z"))) errors.push(".well-known/security.txt: invalid Expires date");
}

const architecture = htmlByRoute.get("architecture-security.html") || "";
if ((architecture.match(/class="arch-svg"/gu) || []).length !== 4 || (architecture.match(/<title id=/gu) || []).length !== 4 || (architecture.match(/<desc id=/gu) || []).length !== 4) errors.push("architecture-security.html: expected four titled and described diagrams");
if (/class="diagram-card"[\s\S]*?<h3>/u.test(architecture)) errors.push("architecture-security.html: duplicate diagram panel heading");
const svgPaths = [...architecture.matchAll(/<path\b[^>]*>/gu)].map((match) => match[0]);
const markerPaths = svgPaths.filter((tag) => tag.includes('fill="#ff8c80"'));
if (markerPaths.length !== 4) errors.push("architecture-security.html: expected four explicit marker geometries");
for (const tag of svgPaths) if (!tag.includes('fill="#ff8c80"') && !tag.includes('fill="none"')) errors.push(`architecture-security.html: connector path lacks fill="none": ${tag}`);
for (const required of ["user-initiated sanitised CSV generation", "Once downloaded, the sanitised file is outside the Salesforce trust boundary", "Unknown/Error · Not applicable", "Unknown/Error · Not assessed"]) if (!architecture.includes(required)) errors.push(`architecture-security.html: missing architecture boundary or terminology text ${required}`);
const boundary = { x: 24, y: 38, width: 1112, height: 350 };
const csvBox = { x: 760, y: 272, width: 330, height: 78 };
const clearances = [csvBox.x - boundary.x, csvBox.y - boundary.y, (boundary.x + boundary.width) - (csvBox.x + csvBox.width), (boundary.y + boundary.height) - (csvBox.y + csvBox.height)];
if (!architecture.includes('<rect x="24" y="38" width="1112" height="350"') || !architecture.includes('<rect x="760" y="272" width="330" height="78"') || clearances.some((clearance) => clearance < 24)) errors.push("architecture-security.html: Diagram 1 CSV box is not at least 24px inside the trust boundary");

const evidence = htmlByRoute.get("security-observatory/evidence.html") || "";
for (const required of [
  "<h3>Severity</h3><ul><li>Critical</li><li>High</li><li>Moderate</li></ul>",
  "<h3>Outcome</h3><ul><li>Risk evidence</li><li>No risk evidence surfaced</li><li>Unknown/Error</li><li>Not applicable</li></ul>",
  "<h3>Coverage</h3><ul><li>Automated</li><li>Partial Evidence</li><li>Manual Required</li><li>Not Covered</li><li>Extended Check</li></ul>",
  "<h3>Retained evidence state</h3><ul><li>Risk evidence</li><li>No risk evidence surfaced</li><li>Unknown/Error</li><li>Not assessed</li></ul>"
]) if (!evidence.includes(required)) errors.push(`security-observatory/evidence.html: terminology drift in ${required}`);

const styles = await readFile(path.join(root, "site-src/styles.css"), "utf8");
const primaryColour = /--button-primary:\s*(#[0-9a-f]{6})/iu.exec(styles)?.[1];
if (!primaryColour || contrastRatio(primaryColour, "#ffffff") < 4.5 || !styles.includes(".button-primary { background: var(--button-primary); color: #fff; }")) errors.push("site-src/styles.css: primary button contrast is below 4.5:1 or colour is not applied");
if (!styles.includes("#main { scroll-margin-top:") || /\[id\][^{]*scroll-margin|:target[^{]*scroll-margin/iu.test(styles)) errors.push("site-src/styles.css: skip-link fragment offset is missing or too broad for SVG IDs");
if (!styles.includes(".card-grid-five { grid-template-columns: repeat(6") || !styles.includes(".card-grid-five .card:nth-last-child(-n + 2) { grid-column: span 3; }")) errors.push("site-src/styles.css: missing 3+2 desktop product-card layout");
if (!styles.includes(".contact-grid { display: grid; grid-template-columns: repeat(2")) errors.push("site-src/styles.css: missing two-column Contact layout");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${routes.length} routes, ${expectedImages.size} approved public images, strict PNG/JPEG/ICO decoding, metadata, legal content, architecture, terminology, accessibility and exclusions with no errors.`);
