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
  ["favicon.svg", "2dbc5023b718e959c69d27a42558b002b704399fb42d8b6298020fa5df97215c"],
  ["mstile-150x150.png", "4417d9367cad3ab2e9949d1bca38646115ef9bea3db4c8976b48752963d5929f"],
  ["assets/android-chrome-192x192.png", "5af19460703089a8ff214413844aeafeb62920529b13ced37315dd56ccdf9661"],
  ["assets/android-chrome-512x512.png", "c194e9a1687190110b2bce2e2ceeefac97bb5c8ff050df53a9e0197c601502a8"],
  ["assets/fortmilo-brand-banner-1200x675.png", "f01e55a44b8bdf309c41c4899a7917dd1982c1845d8a9c295bf0d8788e10fc13"],
  ["assets/fortmilo-salesforce-partner-home.png", "3ce373a0add77fd997dca3e24e7f99859766e6df8ebb981d9fe35e8c043cd5ac"],
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
  ["assets/fortmilo-salesforce-partner-home.png", [1254, 1254]],
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
  '<meta property="og:site_name" content="FortMilo">',
  `<meta property="og:image" content="${previewImageUrl}">`,
  '<meta property="og:image:type" content="image/jpeg">',
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  `<meta property="og:image:alt" content="${previewImageAlt}">`,
  '<meta name="twitter:card" content="summary_large_image">',
  `<meta name="twitter:image" content="${previewImageUrl}">`,
  `<meta name="twitter:image:alt" content="${previewImageAlt}">`
];

const expectedHomepageTitle = "FortMilo | Security Observatory for Salesforce";
const expectedHomepageDescription = "FortMilo is a Salesforce Partner developing Security Observatory, a read-only Salesforce security evidence application for access, exposure and evidence gaps.";
const expectedWebSite = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "FortMilo",
  url: "https://fortmilo.co.uk/"
};
const expectedOrganization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://fortmilo.co.uk/#organization",
  name: "FortMilo",
  url: "https://fortmilo.co.uk/",
  logo: "https://fortmilo.co.uk/assets/fortmilo-shield-512.png",
  email: "info@fortmilo.co.uk",
  description: "FortMilo develops Security Observatory, a read-only Salesforce security evidence application."
};
const expectedHomepageBodyHash = "4bc037b4050e3981558ad2d0c2c21e152e89528cd8ee1f724071237952641e4e";
const expectedRobots = "User-agent: *\nAllow: /\nSitemap: https://fortmilo.co.uk/sitemap.xml\n";
const expectedIndexableCanonicals = [
  "https://fortmilo.co.uk/",
  "https://fortmilo.co.uk/security-observatory/",
  "https://fortmilo.co.uk/security-observatory/findings.html",
  "https://fortmilo.co.uk/security-observatory/identity-access.html",
  "https://fortmilo.co.uk/security-observatory/external-connections.html",
  "https://fortmilo.co.uk/security-observatory/entitlements-assets.html",
  "https://fortmilo.co.uk/security-observatory/evidence.html",
  "https://fortmilo.co.uk/architecture-security.html",
  "https://fortmilo.co.uk/documents/",
  "https://fortmilo.co.uk/acknowledgements.html",
  "https://fortmilo.co.uk/contact.html",
  "https://fortmilo.co.uk/privacy.html",
  "https://fortmilo.co.uk/terms.html"
];

const prohibitedMonetaryWording = new RegExp([
  "[£$€]",
  ["limitation", "of liability"].join(" "),
  ["fees", "paid"].join(" "),
  ["aggregate", "liability"].join(" "),
  ["liability", "cap"].join(" "),
  ["relevant", "service"].join(" ")
].join("|"), "iu");
const requiredPartnerStatus = "FortMilo is a Salesforce Partner.";
const requiredProductIndependence = "Security Observatory is independently developed and is not endorsed by Salesforce, Inc.";
const requiredSalesforceTrademark = "Salesforce is a trademark of Salesforce, Inc.";
const prohibitedSalesforceClaims = [
  ["Salesforce", "approved"].join(" "),
  ["Salesforce", "certified"].join(" "),
  ["Salesforce", "recommended"].join(" "),
  ["Salesforce sponsored", "Security Observatory"].join(" "),
  ["AppExchange", "approved"].join(" "),
  ["AppExchange", "certified"].join(" "),
  ["AppExchange", "listed"].join(" ")
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

function collectStructuredDataNodes(value, nodes = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectStructuredDataNodes(item, nodes);
  } else if (value && typeof value === "object") {
    if (Object.hasOwn(value, "@type")) nodes.push(value);
    for (const nested of Object.values(value)) collectStructuredDataNodes(nested, nodes);
  }
  return nodes;
}

function hasExactProperties(actual, expected) {
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return JSON.stringify(actualKeys) === JSON.stringify(expectedKeys)
    && expectedKeys.every((key) => actual[key] === expected[key]);
}

function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
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
      if (relativePath === "assets/fortmilo-salesforce-partner-home.png" && png.colourType !== 6) errors.push(`${relativePath}: expected RGBA PNG colour type`);
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
const structuredDataByRoute = new Map();
const structuredDataScriptCountByRoute = new Map();
for (const route of routes) {
  const buffer = await readRequired(route.output);
  if (!buffer) continue;
  const html = buffer.toString("utf8");
  htmlByRoute.set(route.output, html);
  const scriptElements = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)];
  const scriptOpenCount = (html.match(/<script\b/giu) || []).length;
  const scriptCloseCount = (html.match(/<\/script>/giu) || []).length;
  if (scriptElements.length !== scriptOpenCount || scriptElements.length !== scriptCloseCount) errors.push(`${route.output}: malformed script element`);
  const structuredDataNodes = [];
  for (const scriptElement of scriptElements) {
    if (scriptElement[1].trim() !== 'type="application/ld+json"') {
      errors.push(`${route.output}: executable or non-JSON-LD script found`);
      continue;
    }
    try {
      collectStructuredDataNodes(JSON.parse(scriptElement[2]), structuredDataNodes);
    } catch (error) {
      errors.push(`${route.output}: JSON-LD is not valid JSON (${error.message})`);
    }
  }
  structuredDataByRoute.set(route.output, structuredDataNodes);
  structuredDataScriptCountByRoute.set(route.output, scriptElements.length);
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
  if ((html.match(/<meta property="og:site_name" content="FortMilo">/gu) || []).length !== 1) errors.push(`${route.output}: expected exactly one FortMilo og:site_name`);
  if ((html.match(/\/favicon\.svg/gu) || []).length !== 1) errors.push(`${route.output}: expected exactly one /favicon.svg reference`);
  const headerLogo = '<img src="/assets/fortmilo-shield-512.png" alt="" width="512" height="512"><span>FortMilo</span>';
  if (!html.includes(headerLogo)) errors.push(`${route.output}: missing approved compact header logo or intrinsic dimensions`);
  if ((html.match(/<img src="\/assets\/fortmilo-shield-512\.png"/gu) || []).length !== 1) errors.push(`${route.output}: expected one compact header-logo image reference`);
  const bannerCount = (html.match(/\/assets\/fortmilo-brand-banner-1200x675\.png/gu) || []).length;
  if (bannerCount !== 0) errors.push(`${route.output}: obsolete primary banner found`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/gu)].map((match) => match[1]);
  if (new Set(ids).size !== ids.length) errors.push(`${route.output}: duplicate id`);
  if (/google(?:-|\s)?analytics|googletagmanager|google tag manager|\bGTM(?:-[A-Z0-9]+)?\b|gtag\s*\(|plausible|matomo|tracking[\s_-]*pixel|marketing[\s_-]*cookie/iu.test(html)) errors.push(`${route.output}: analytics, tag manager, tracking pixel or marketing cookie found`);
  if (/\son[a-z]+\s*=|(?:href|src)\s*=\s*["']javascript:/iu.test(html)) errors.push(`${route.output}: executable client-side JavaScript hook found`);
  if (/\b(?:AI|GPT|Codex|Claude|Gemini)\b/iu.test(html)) errors.push(`${route.output}: AI reference found`);
  if (/AppExchange|approved by Salesforce|(?<!not )endorsed by Salesforce/iu.test(html)) errors.push(`${route.output}: prohibited Salesforce relationship claim`);
  for (const claim of prohibitedSalesforceClaims) if (html.includes(claim)) errors.push(`${route.output}: prohibited Salesforce or AppExchange claim ${claim}`);
  if (/href="https:\/\/github\.com\/Fortmilo\//iu.test(html)) errors.push(`${route.output}: prohibited GitHub repository link`);
  if (/FortMilo Lab|individual applicant|pending-address|business-address confirmation|actual application terminology|where supported/iu.test(html)) errors.push(`${route.output}: stale identity, address or terminology wording`);
  if (prohibitedMonetaryWording.test(html)) errors.push(`${route.output}: prohibited monetary liability wording found`);
  if (!html.includes("Luca Pacini, trading as FortMilo.") || !html.includes("Harpenden, Hertfordshire, United Kingdom.") || !html.includes(requiredPartnerStatus) || !html.includes(requiredProductIndependence) || !html.includes(requiredSalesforceTrademark)) errors.push(`${route.output}: incomplete approved footer identity, Partner status or product disclaimer`);
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

const homepageStructuredData = structuredDataByRoute.get("index.html") || [];
const websiteNodes = homepageStructuredData.filter((node) => node["@type"] === "WebSite");
const organizationNodes = homepageStructuredData.filter((node) => node["@type"] === "Organization");
if (structuredDataScriptCountByRoute.get("index.html") !== 2 || homepageStructuredData.length !== 2) errors.push("index.html: expected exactly two data-only JSON-LD scripts and nodes");
if (websiteNodes.length !== 1) errors.push("index.html: expected exactly one WebSite JSON-LD node");
else {
  if (!hasExactProperties(websiteNodes[0], expectedWebSite)) errors.push("index.html: WebSite JSON-LD values differ from governance");
  if (Object.hasOwn(websiteNodes[0], "alternateName")) errors.push("index.html: WebSite alternateName is not authorised");
}
if (organizationNodes.length !== 1) errors.push("index.html: expected exactly one Organization JSON-LD node");
else {
  if (!hasExactProperties(organizationNodes[0], expectedOrganization)) errors.push("index.html: Organization JSON-LD values differ from governance");
  if (Object.hasOwn(organizationNodes[0], "address")) errors.push("index.html: Organization address is not authorised");
  if (Object.hasOwn(organizationNodes[0], "telephone")) errors.push("index.html: Organization telephone is not authorised");
}
for (const [output, nodes] of structuredDataByRoute) {
  if (nodes.some((node) => node["@type"] === "LocalBusiness")) errors.push(`${output}: LocalBusiness JSON-LD is not authorised`);
  if (output !== "index.html" && nodes.some((node) => ["WebSite", "Organization"].includes(node["@type"]))) errors.push(`${output}: WebSite and Organization JSON-LD must be homepage-only`);
  if (output !== "index.html" && structuredDataScriptCountByRoute.get(output) !== 0) errors.push(`${output}: unexpected JSON-LD script outside the homepage`);
}

const indexableRoutes = routes.filter((route) => !route.noindex);
const today = new Date().toISOString().slice(0, 10);
const actualIndexableCanonicals = indexableRoutes.map((route) => route.canonical);
if (JSON.stringify(actualIndexableCanonicals) !== JSON.stringify(expectedIndexableCanonicals)) errors.push("site-src/site-map.mjs: intended public canonical route coverage or order changed");
if (new Set(actualIndexableCanonicals).size !== actualIndexableCanonicals.length) errors.push("site-src/site-map.mjs: duplicate indexable canonical route");
for (const route of indexableRoutes) {
  if (!isValidDateOnly(route.lastmod)) errors.push(`${route.output}: missing or invalid route lastmod`);
  else if (route.lastmod > today) errors.push(`${route.output}: route lastmod is in the future`);
}
if (new Set(indexableRoutes.map((route) => route.lastmod)).size === 1) errors.push("site-src/site-map.mjs: all route lastmod values are mechanically identical");

const expectedSitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexableRoutes.map((route) => `  <url><loc>${route.canonical}</loc><lastmod>${route.lastmod}</lastmod></url>`).join("\n")}\n</urlset>\n`;
const sitemapBuffer = await readRequired("sitemap.xml");
if (sitemapBuffer) {
  const sitemap = sitemapBuffer.toString("utf8");
  if (sitemap !== expectedSitemap) errors.push("sitemap.xml: content does not match the canonical indexable route map and per-route lastmod values");
  const entries = [...sitemap.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod><\/url>/gu)].map((match) => ({ canonical: match[1], lastmod: match[2] }));
  if (entries.length !== indexableRoutes.length || (sitemap.match(/<url>/gu) || []).length !== entries.length) errors.push("sitemap.xml: malformed or unexpected URL entry");
  for (const route of indexableRoutes) {
    const matches = entries.filter((entry) => entry.canonical === route.canonical);
    if (matches.length !== 1) errors.push(`sitemap.xml: expected ${route.canonical} exactly once`);
    else if (matches[0].lastmod !== route.lastmod) errors.push(`sitemap.xml: wrong lastmod for ${route.canonical}`);
  }
  for (const entry of entries) {
    let parsed;
    try {
      parsed = new URL(entry.canonical);
    } catch {
      errors.push(`sitemap.xml: invalid URL ${entry.canonical}`);
      continue;
    }
    if (parsed.protocol !== "https:" || parsed.hostname !== "fortmilo.co.uk" || parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash) errors.push(`sitemap.xml: non-canonical URL ${entry.canonical}`);
    if (!isValidDateOnly(entry.lastmod)) errors.push(`sitemap.xml: invalid lastmod ${entry.lastmod}`);
    else if (entry.lastmod > today) errors.push(`sitemap.xml: future lastmod ${entry.lastmod}`);
  }
  for (const route of routes.filter((route) => route.noindex)) if (entries.some((entry) => entry.canonical === route.canonical)) errors.push(`sitemap.xml: noindex route included ${route.canonical}`);
  if (entries.some((entry) => entry.canonical.endsWith(".pdf"))) errors.push("sitemap.xml: PDF must not be included in the HTML route sitemap");
}

const robotsBuffer = await readRequired("robots.txt");
if (robotsBuffer && robotsBuffer.toString("utf8").replace(/\r\n?/gu, "\n") !== expectedRobots) errors.push("robots.txt: crawl allow-list or sitemap reference changed");

const textFiles = allFiles.filter((file) => [".html", ".css", ".mjs", ".js", ".json", ".xml", ".md", ".txt", ".ps1", ".webmanifest"].includes(path.extname(file).toLowerCase()) || path.basename(file) === "site.webmanifest");
const obsoleteWhitepaperPath = ["/documents/evidence-semantics-and-scanner-orchestration", ".pdf"].join("");
for (const relativePath of textFiles) {
  const text = await readFile(path.join(root, relativePath), "utf8");
  for (const token of staleAssetTokens) if (text.includes(token)) errors.push(`${relativePath}: stale asset reference ${token}`);
  if (text.includes(directGovernanceUnixPath) || text.includes(directGovernanceWindowsPath) || directMasterPattern.test(text)) errors.push(`${relativePath}: direct governance-master path`);
  if (text.includes(obsoleteWhitepaperPath)) errors.push(`${relativePath}: obsolete unversioned whitepaper reference`);
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
const homepageH1 = "Salesforce security evidence collected and retained inside your org.";
const homepageSupport = "Bring OAuth grants, privileged access, external exposure and evidence gaps into one review surface, with reasons and safe next actions kept explicit.";
const homepageDescription = expectedHomepageDescription;
const homepageChips = ["Read-only", "No automatic remediation", "Evidence retained in your org"];
const differentiators = [
  ["Read-only by design", "Reports evidence and limitations without revoking tokens, removing permissions, blocking APIs, changing endpoints or writing security changes back to Salesforce."],
  ["Evidence retained inside Salesforce", "Evidence collection, review and retained context remain within the subscriber organisation."],
  ["Unavailable evidence stays explicit", "Blocked or incomplete sources remain Not assessed, with a reason and a safe next action. Missing evidence is not converted into zero."],
  ["Sanitised evidence by design", "Evidence is presented without tokens, session identifiers, raw IP addresses, secrets, private keys, certificate bodies or credential values."],
  ["Prioritise access and exposure", "Focus review on OAuth grants, privileged access and externally exposed surfaces, with affected users, applications or assets shown where retained evidence supports it."]
];
const homepageCorporateNav = '<nav class="corporate-nav" aria-label="Corporate navigation"><a aria-current="page" href="/">Home</a><a href="/security-observatory/">Security Observatory</a><a href="/architecture-security.html">Architecture & Security</a><a href="/contact.html">Contact</a></nav>';
const illustrativePanel = '<aside class="illustrative-evidence" aria-labelledby="illustrative-evidence-label"><p id="illustrative-evidence-label" class="evidence-label">Illustrative evidence state</p><dl><div><dt>State</dt><dd>Not assessed</dd></div><div><dt>Reason</dt><dd>The evidence source was unavailable or incomplete.</dd></div><div><dt>Next safe action</dt><dd>Review access to the required source, then rerun the scan.</dd></div></dl><footer>Illustrative example — no organisation data shown.</footer></aside>';
const sbsAttribution = '<p class="sbs-attribution">References control identifiers from the independent <a href="https://www.securitybenchmark.org/">Security Benchmark for Salesforce (SBS)</a>, licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.</p>';
const homepageArtwork = '<figure class="home-hero-artwork"><img src="/assets/fortmilo-salesforce-partner-home.png" alt="FortMilo — Salesforce Partner" width="1254" height="1254"></figure>';
const technicalReviewCta = '<section class="section section-accent"><div class="container"><div class="section-heading"><p class="section-label">Next steps</p><h2>Continue the technical review</h2><p>Review the evidence model in depth, request a launch notification or contact FortMilo with a technical question.</p></div><div class="actions"><a class="button button-primary" href="/documents/evidence-semantics-and-scanner-orchestration-v1.3.pdf">Read the technical whitepaper</a><a class="button button-secondary" href="mailto:info@fortmilo.co.uk?subject=Security%20Observatory%20launch%20notification">Notify me at launch</a><a class="button button-secondary" href="/contact.html">Contact FortMilo</a></div></div></section>';
if ((homepage.split(homepageH1).length - 1) !== 1 || !homepage.includes(`<h1>${homepageH1}</h1>`)) errors.push("index.html: expected the exact homepage h1 once");
if ((homepage.split(homepageSupport).length - 1) !== 1 || !homepage.includes(`<p class="lead">${homepageSupport}</p>`)) errors.push("index.html: expected the exact homepage support copy once");
if (!homepage.includes("<h2>Evidence designed for Salesforce security review</h2>")) errors.push("index.html: missing exact differentiator heading");
for (const [heading, copy] of differentiators) {
  if ((homepage.split(heading).length - 1) !== 1 || !homepage.includes(`<h3>${heading}</h3>`)) errors.push(`index.html: expected differentiator heading once ${heading}`);
  if (!homepage.includes(`<p>${copy}</p>`)) errors.push(`index.html: missing differentiator copy ${heading}`);
}
const heroChips = /<ul class="hero-chips"[^>]*>([\s\S]*?)<\/ul>/u.exec(homepage)?.[1] || "";
if ((homepage.match(/class="hero-chips"/gu) || []).length !== 1 || (heroChips.match(/<li>/gu) || []).length !== 3) errors.push("index.html: expected exactly three trust chips");
for (const chip of homepageChips) if ((heroChips.split(`<li>${chip}</li>`).length - 1) !== 1) errors.push(`index.html: expected approved trust chip once ${chip}`);
if ((homepage.match(/class="card differentiator-card"/gu) || []).length !== 5) errors.push("index.html: expected exactly five differentiator cards");
if (!homepage.includes(illustrativePanel)) errors.push("index.html: illustrative evidence panel content or semantics differ from the approved contract");
if (!homepage.includes(sbsAttribution)) errors.push("index.html: SBS attribution or approved links differ from the approved contract");
if ((homepage.match(/\/assets\/fortmilo-salesforce-partner-home\.png/gu) || []).length !== 1 || !homepage.includes(homepageArtwork)) errors.push("index.html: expected one approved FortMilo Salesforce Partner artwork reference with intrinsic dimensions");
if ((homepage.split("Continue the technical review").length - 1) !== 1 || !homepage.includes(technicalReviewCta)) errors.push("index.html: technical review CTA content or links differ from the approved contract");
if (!(homepage.indexOf(sbsAttribution) < homepage.indexOf(technicalReviewCta) && homepage.indexOf(technicalReviewCta) < homepage.indexOf('<footer class="site-footer">'))) errors.push("index.html: technical review CTA must follow the SBS attribution and precede the shared footer");
if (!homepage.includes(homepageCorporateNav)) errors.push("index.html: corporate navigation labels, order or active state differ from the approved contract");
if (!homepage.includes(`<meta name="description" content="${homepageDescription}">`) || !homepage.includes(`<meta property="og:description" content="${homepageDescription}">`)) errors.push("index.html: incorrect homepage descriptions");
if (!homepage.includes(`<title>${expectedHomepageTitle}</title>`) || !homepage.includes(`<meta property="og:title" content="${expectedHomepageTitle}">`)) errors.push("index.html: incorrect homepage title or og:title");
const homepageBodyStart = homepage.indexOf("<body");
const homepageBodyEnd = homepage.indexOf("</body>");
const homepageBody = homepageBodyStart >= 0 && homepageBodyEnd >= homepageBodyStart ? homepage.slice(homepageBodyStart, homepageBodyEnd + 7).replace(/\r\n?/gu, "\n") : "";
if (sha256(Buffer.from(homepageBody, "utf8")) !== expectedHomepageBodyHash) errors.push("index.html: visible homepage body differs from the authorised baseline");
if (!homepage.includes('<a class="button button-primary" href="/security-observatory/">Explore Security Observatory</a>') || !homepage.includes('<a class="button button-secondary" href="/contact.html">Contact</a>')) errors.push("index.html: incorrect homepage actions");
for (const prohibited of [
  "Security Observatory by FortMilo",
  "Read-only security evidence for Salesforce.",
  "hero-brand-art",
  "fortmilo-brand-banner-1200x675",
  "What happened",
  "Subscriber-owned authentication"
]) if (homepage.includes(prohibited)) errors.push(`index.html: obsolete or unapproved homepage content ${prohibited}`);

const terms = htmlByRoute.get("terms.html") || "";
for (const required of [
  "Last updated:</strong> 8 August 2026",
  "Luca Pacini, trading as FortMilo",
  "Any Security Observatory source material published by FortMilo is licensed as stated with that material",
  "Apache License 2.0",
  "Source publication does not by itself represent package availability, release validation or installation readiness.",
  "Creative Commons Attribution-ShareAlike 4.0 International",
  "No Security Benchmark for Salesforce control prose is reproduced",
  "law of England and Wales",
  "courts of England and Wales have exclusive jurisdiction"
]) if (!terms.includes(required)) errors.push(`terms.html: missing required clause ${required}`);
for (const prohibited of [
  ["The public Security Observatory repository", "is licensed under"].join(" "),
  ["Limitation", "of liability"].join(" "),
  ["£", "100"].join(""),
  ["fees", "paid"].join(" "),
  ["aggregate", "liability"].join(" "),
  ["relevant", "service"].join(" "),
  "£"
]) if (terms.includes(prohibited)) errors.push(`terms.html: prohibited release or monetary wording ${prohibited}`);

const privacy = htmlByRoute.get("privacy.html") || "";
for (const required of [
  "Last updated:</strong> 8 August 2026",
  "Controller:</strong> Luca Pacini, trading as FortMilo",
  "Harpenden, Hertfordshire, United Kingdom",
  "12 months after the enquiry closes",
  "IP address",
  "Personal information is not sold. It may be disclosed when required by law or processed by providers supporting website hosting, email delivery and storage, and necessary IT, security or professional support.",
  "outside the United Kingdom",
  "right to object to processing based on legitimate interests",
  "Information Commissioner’s Office"
]) if (!privacy.includes(required)) errors.push(`privacy.html: missing required privacy wording ${required}`);
const privacyPlaceholder = ["An email provider is not named here", "because no provider has been confirmed for publication."].join(" ");
if (privacy.includes(privacyPlaceholder)) errors.push(`privacy.html: prohibited placeholder wording ${privacyPlaceholder}`);

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
if ((architecture.match(/<p class="section-label">Diagram [1-4]<\/p>/gu) || []).length !== 4) errors.push("architecture-security.html: expected all four numbered diagram sections");
if (/class="diagram-card"[\s\S]*?<h3>/u.test(architecture)) errors.push("architecture-security.html: duplicate diagram panel heading");
const svgPaths = [...architecture.matchAll(/<path\b[^>]*>/gu)].map((match) => match[0]);
const markerPaths = svgPaths.filter((tag) => tag.includes('fill="#ff8c80"'));
if (markerPaths.length !== 4) errors.push("architecture-security.html: expected four explicit marker geometries");
for (const tag of svgPaths) if (!tag.includes('fill="#ff8c80"') && !tag.includes('fill="none"')) errors.push(`architecture-security.html: connector path lacks fill="none": ${tag}`);
const whitepaperPath = "/documents/evidence-semantics-and-scanner-orchestration-v1.3.pdf";
const whitepaperTitle = "Evidence Semantics and Scanner Orchestration v1.3";
for (const required of ["Technical whitepaper", whitepaperTitle, "Read the technical whitepaper"]) if (!architecture.includes(required)) errors.push(`architecture-security.html: missing ${required}`);
if (!architecture.includes(`href="${whitepaperPath}"`)) errors.push("architecture-security.html: missing versioned technical whitepaper link");
for (const prohibited of ["Continue the technical review", "Notify me at launch", 'href="mailto:info@fortmilo.co.uk?subject=Security%20Observatory%20launch%20notification"', ">Contact FortMilo</a>"]) if (architecture.includes(prohibited)) errors.push(`architecture-security.html: moved technical review CTA remains ${prohibited}`);
for (const required of ["USER-INITIATED DOWNLOAD", "Downloaded</text><text", "Once downloaded, the sanitised file is outside the Salesforce trust boundary"]) if (!architecture.includes(required)) errors.push(`architecture-security.html: missing explicit CSV boundary crossing detail ${required}`);
for (const required of ["PACKAGED CORE", "SUBSCRIBER-OWNED SETUP", "TRUST / OWNERSHIP BOUNDARY", 'data-boundary-orientation="vertical"', "TOOLING EVIDENCE UNAVAILABLE", "Not assessed with a bounded reason", "limitation and safe next action"]) if (!architecture.includes(required)) errors.push(`architecture-security.html: missing subscriber-authentication boundary detail ${required}`);
for (const required of ["Can usable evidence", "USABLE", "EVIDENCE", "UNAVAILABLE OR", "INCOMPLETE EVIDENCE", "NOT ASSESSED", "Explicit reason", "SAFE NEXT", "ACTION"]) if (!architecture.includes(required)) errors.push(`architecture-security.html: missing usable/unavailable evidence branch detail ${required}`);
const prohibitedArchitectureMarketing = [
  ["Already on External Client", "Apps"].join(" "),
  ["External Client App", "ready"].join(" "),
  ["Future-proof External Client", "Apps"].join(" "),
  ["Modern External Client App", "architecture"].join(" "),
  ["AppExchange", "-ready authentication"].join(""),
  ["Built for the May 2026", "requirement"].join(" ")
];
for (const wording of prohibitedArchitectureMarketing) if (architecture.includes(wording)) errors.push(`architecture-security.html: prohibited External Client App marketing ${wording}`);

const documents = htmlByRoute.get("documents/index.html") || "";
if (!allFiles.includes(whitepaperPath.slice(1))) errors.push(`missing ${whitepaperPath.slice(1)}`);
for (const required of ["Technical whitepaper", whitepaperTitle, `href="${whitepaperPath}"`, "Read the technical whitepaper"]) if (!documents.includes(required)) errors.push(`documents/index.html: missing ${required}`);
if (!documents.includes('<link rel="canonical" href="https://fortmilo.co.uk/documents/">')) errors.push("documents/index.html: incorrect canonical");

const acknowledgements = htmlByRoute.get("acknowledgements.html") || "";
const acknowledgementSentence = "Special thanks to my wife and sons, and to my former team — Ali, Daniel, Lucas, Jakub, Gerry and John — for believing in me, supporting me and helping me bring this project to life.";
const acknowledgementBoundary = "This acknowledges personal support and individual contributions. It does not imply endorsement of FortMilo or Security Observatory by those individuals or their employers.";
if (!acknowledgements.includes("<h1>Acknowledgements</h1>")) errors.push("acknowledgements.html: missing exact h1");
for (const required of [acknowledgementSentence, "my wife and sons", "Ali", "Daniel", "Lucas", "Jakub", "Gerry", "John", acknowledgementBoundary]) if (!acknowledgements.includes(required)) errors.push(`acknowledgements.html: missing required acknowledgement content ${required}`);
const acknowledgementMain = /<main id="main">([\s\S]*?)<\/main>/u.exec(acknowledgements)?.[1] || "";
if (/<img\b|<script\b|linkedin|social link|job title|biograph/iu.test(acknowledgementMain)) errors.push("acknowledgements.html: prohibited photo, script, social, job-title or biography content");
for (const [output, html] of htmlByRoute) {
  const footerMarkup = /<footer class="site-footer">[\s\S]*?<\/footer>/u.exec(html)?.[0] || "";
  if (!footerMarkup.includes('<a href="/documents/">Technical whitepaper</a>')) errors.push(`${output}: missing Technical whitepaper footer link`);
  if (!footerMarkup.includes('<a href="/acknowledgements.html">Acknowledgements</a>')) errors.push(`${output}: missing Acknowledgements footer link`);
  const corporateNav = /<nav class="corporate-nav"[\s\S]*?<\/nav>/u.exec(html)?.[0] || "";
  if (!corporateNav || corporateNav.includes("Acknowledgements")) errors.push(`${output}: Acknowledgements must not appear in corporate navigation`);
  if (corporateNav.includes("Technical whitepaper")) errors.push(`${output}: Technical whitepaper must not appear in corporate navigation`);
}

const overview = htmlByRoute.get("security-observatory/index.html") || "";
for (const required of ["Sandbox-first", "Not yet available for public installation."]) if (!overview.includes(required)) errors.push(`security-observatory/index.html: missing customer-facing product boundary ${required}`);
const internalPackageClaim = ["Public package distribution", "is not yet claimed."].join(" ");
if (overview.includes(internalPackageClaim)) errors.push("security-observatory/index.html: internal package-claim wording remains");

const evidence = htmlByRoute.get("security-observatory/evidence.html") || "";
for (const required of [
  "This guide uses distinct vocabulary for outcome, coverage and retained evidence state.",
  "<h3>Severity</h3><ul><li>Critical</li><li>High</li><li>Moderate</li></ul>",
  "<h3>Outcome</h3><ul><li>Risk evidence</li><li>No risk evidence surfaced</li><li>Unknown/Error</li><li>Not applicable</li></ul>",
  "<h3>Coverage</h3><ul><li>Automated</li><li>Partial Evidence</li><li>Manual Required</li><li>Not Covered</li><li>Extended Check</li></ul>",
  "<h3>Retained evidence state</h3><ul><li>Risk evidence</li><li>No risk evidence surfaced</li><li>Unknown/Error</li><li>Not assessed</li></ul>",
  "published under CC BY-SA 4.0",
  "Security Observatory works fully without SBS enabled.",
  "SBS version v0.4.0, mapping set M1, revision 1",
  "45</strong><span>SBS controls in the v1 registry",
  "47</strong><span>Mapping metadata records across those controls",
  "11</strong><span>Distinct SBS control-key families mapped",
  "10 of 45 controls",
  "17 of 45 controls",
  "18 of 45 controls",
  "There are no Automated or Extended Check dispositions in the current M1 catalogue.",
  "producing 12 ordered scanner-family associations across the 10 mapped controls",
  "retained SBS control → retained mapped scanner family or families → retained scanner-family evidence state → retained control outcome → related retained family findings",
  "Findings are joined, not stamped:",
  "Family-scoped, not control-exclusive:",
  "not a claim that every finding is uniquely attributable to one SBS control.",
  "<p class=\"section-label\">Safe export</p>",
  "SBS control traceability export — 14 columns",
  "Scan Number, Retained Registry Key, Retained SBS Version, Retained Mapping Revision, Control Key, Control Title, Domain, Coverage Type, Mapped Scanner Families, Retained Family Evidence State, Retained Control Outcome, Retained family findings, Degraded Source, Sanitised Cause.",
  "Formula-injection-safe by default",
  "No raw Salesforce IDs, raw queries, stack traces, tokens, session identifiers, raw IP addresses, credentials or certificate bodies.",
  "Like-for-like comparison",
  "cross-organisation comparison is rejected",
  "Same evidence depth required",
  "Not an SBS drift engine",
  "What a result does not mean",
  "No risk evidence surfaced is not a pass.",
  "Not a compliance decision.",
  "History is not rewritten."
]) if (!evidence.includes(required)) errors.push(`security-observatory/evidence.html: terminology drift in ${required}`);
for (const prohibited of [
  ["The public product source", "does not currently publish application code"].join(" "),
  ["pending release", "verification"].join(" "),
  ["final packaging, installation", "and clean-org verification steps are still in progress"].join(" "),
  "This page describes the current source model."
]) if (evidence.includes(prohibited)) errors.push(`security-observatory/evidence.html: internal release wording remains ${prohibited}`);

const styles = await readFile(path.join(root, "site-src/styles.css"), "utf8");
const primaryColour = /--button-primary:\s*(#[0-9a-f]{6})/iu.exec(styles)?.[1];
if (!primaryColour || contrastRatio(primaryColour, "#ffffff") < 4.5 || !styles.includes(".button-primary { background: var(--button-primary); color: #fff; }")) errors.push("site-src/styles.css: primary button contrast is below 4.5:1 or colour is not applied");
if (!styles.includes("#main { scroll-margin-top:") || /\[id\][^{]*scroll-margin|:target[^{]*scroll-margin/iu.test(styles)) errors.push("site-src/styles.css: skip-link fragment offset is missing or too broad for SVG IDs");
if (!styles.includes(".card-grid-five { grid-template-columns: repeat(6") || !styles.includes(".card-grid-five .card:nth-last-child(-n + 2) { grid-column: span 3; }")) errors.push("site-src/styles.css: missing 3+2 desktop product-card layout");
if (!styles.includes(".contact-grid { display: grid; grid-template-columns: repeat(2")) errors.push("site-src/styles.css: missing two-column Contact layout");
if (/font-weight:\s*750\b/iu.test(styles)) errors.push("site-src/styles.css: prohibited font-weight 750");
if (!/\.corporate-nav a\[aria-current="page"\],\s*\.product-nav a\[aria-current="page"\]\s*\{[^}]*color:\s*#fff;[^}]*background:\s*transparent;[^}]*box-shadow:\s*inset 0 -2px 0 var\(--accent\);[^}]*\}/iu.test(styles)) errors.push("site-src/styles.css: active navigation must use white text, a transparent background and a thin red underline");
if (!/\.corporate-nav a:hover,\s*\.product-nav a:hover\s*\{[^}]*background:\s*rgba\(255, 255, 255, \.07\);[^}]*\}/iu.test(styles)) errors.push("site-src/styles.css: navigation hover treatment must remain distinct from active navigation");
if (!styles.includes(":focus-visible { outline: 3px solid var(--accent-soft); outline-offset: 3px; }")) errors.push("site-src/styles.css: distinct focus-visible treatment is missing");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${routes.length} routes, ${expectedImages.size} approved public images, strict PNG/JPEG/ICO decoding, metadata, legal content, architecture, terminology, accessibility and exclusions with no errors.`);
