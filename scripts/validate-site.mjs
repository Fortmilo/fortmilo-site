import { createHash } from "node:crypto";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routes } from "../site-src/site-map.mjs";
import { brandBannerPath, previewImageAlt, previewImagePath, previewImageUrl } from "../site-src/templates.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlFiles = [];
const errors = [];
const approvedBrandBannerSha256 = "aa2f49d9416ee2feea13305e00c33e1db4855793771cd5a88943a9c987a04948";
const routeByOutput = new Map(routes.map((route) => [route.output, route]));
const staleReferences = [
  ["fortmilo-security-observatory-og", "-v2.png"].join(""),
  ["/assets/apple-touch-", "icon.png"].join(""),
  ["/assets/favicon-", "32.png"].join("")
];
const requiredIconLinks = [
  '<link rel="icon" href="/favicon.ico" sizes="any">',
  '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
  '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">',
  '<link rel="manifest" href="/site.webmanifest">'
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

async function walk(dir) {
  for (const name of await readdir(dir)) {
    if (["site-src", "scripts", ".git"].includes(name)) continue;
    const full = path.join(dir, name);
    const info = await stat(full);
    if (info.isDirectory()) await walk(full);
    else if (name.endsWith(".html")) htmlFiles.push(full);
  }
}

function parsePng(buffer, label) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) {
    throw new Error(`${label}: invalid PNG signature`);
  }
  if (buffer.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error(`${label}: missing PNG IHDR`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colourType: buffer[25]
  };
}

function parseJpeg(buffer, label) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error(`${label}: invalid JPEG signature`);
  }
  let offset = 2;
  let frame;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) throw new Error(`${label}: invalid JPEG marker at ${offset}`);
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) throw new Error(`${label}: truncated JPEG segment`);
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) throw new Error(`${label}: invalid JPEG segment length`);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8) throw new Error(`${label}: invalid JPEG frame header`);
      frame = {
        marker,
        width: buffer.readUInt16BE(offset + 5),
        height: buffer.readUInt16BE(offset + 3),
        components: buffer[offset + 7]
      };
      break;
    }
    offset += length;
  }
  if (!frame) throw new Error(`${label}: missing JPEG frame header`);
  return frame;
}

function parseIco(buffer, label) {
  if (buffer.length < 6) throw new Error(`${label}: truncated ICO header`);
  if (buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) {
    throw new Error(`${label}: invalid ICO header`);
  }
  const count = buffer.readUInt16LE(4);
  if (!count || buffer.length < 6 + (count * 16)) throw new Error(`${label}: invalid ICO directory`);
  const sizes = new Set();
  for (let index = 0; index < count; index += 1) {
    const entryOffset = 6 + (index * 16);
    const width = buffer[entryOffset] || 256;
    const height = buffer[entryOffset + 1] || 256;
    const bytesInResource = buffer.readUInt32LE(entryOffset + 8);
    const imageOffset = buffer.readUInt32LE(entryOffset + 12);
    if (!bytesInResource || imageOffset + bytesInResource > buffer.length) {
      throw new Error(`${label}: invalid ${width}x${height} directory entry`);
    }
    const image = buffer.subarray(imageOffset, imageOffset + bytesInResource);
    let embeddedWidth;
    let embeddedHeight;
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (image.length >= 8 && image.subarray(0, 8).equals(pngSignature)) {
      const png = parsePng(image, `${label} ${width}x${height}`);
      embeddedWidth = png.width;
      embeddedHeight = png.height;
    } else {
      if (image.length < 40 || image.readUInt32LE(0) < 40) {
        throw new Error(`${label}: unsupported ${width}x${height} image payload`);
      }
      embeddedWidth = Math.abs(image.readInt32LE(4));
      embeddedHeight = Math.abs(image.readInt32LE(8)) / 2;
    }
    if (embeddedWidth !== width || embeddedHeight !== height) {
      throw new Error(`${label}: ${width}x${height} directory entry does not match embedded image`);
    }
    sizes.add(`${width}x${height}`);
  }
  return sizes;
}

async function readRequired(relativePath) {
  try {
    return await readFile(path.join(root, relativePath));
  } catch {
    errors.push(`missing ${relativePath}`);
    return null;
  }
}

await walk(root);
const previewReferences = new Set();
const banned = [
  /\bPass\b/u,
  /\bFail\b/u,
  /SBS-aligned/iu,
  /FortMilo Security Observatory/iu,
  /Salesforce Security Observatory/iu,
  /nav-fix/iu,
  /font-weight:\s*750/iu,
  /GPT|Codex|Claude|Gemini/iu
];

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const rel = path.relative(root, file).split(path.sep).join("/");
  const route = routeByOutput.get(rel);
  if ((html.match(/<h1\b/gu) || []).length !== 1) errors.push(`${rel}: expected one h1`);
  for (const required of ["<title>", 'name="description"', 'rel="canonical"', 'property="og:title"', 'property="og:description"', 'property="og:url"', 'rel="stylesheet"']) {
    if (!html.includes(required)) errors.push(`${rel}: missing ${required}`);
  }
  if (route && !html.includes(`<link rel="canonical" href="${route.canonical}">`)) {
    errors.push(`${rel}: incorrect canonical URL`);
  }
  for (const required of requiredIconLinks) {
    if (!html.includes(required)) errors.push(`${rel}: missing ${required}`);
  }
  if (html.includes('rel="icon" type="image/svg+xml"')) errors.push(`${rel}: obsolete SVG favicon link`);
  const brandReferences = (html.match(new RegExp(brandBannerPath, "gu")) || []).length;
  const expectedBrandReferences = rel === "index.html" ? 2 : 1;
  if (brandReferences !== expectedBrandReferences) {
    errors.push(`${rel}: expected ${expectedBrandReferences} approved brand artwork reference(s)`);
  }
  if (html.includes(["/assets/fortmilo-logo", ".svg"].join(""))) errors.push(`${rel}: obsolete logo artwork reference`);
  for (const required of requiredSocialMetadata) {
    if (!html.includes(required)) errors.push(`${rel}: missing ${required}`);
  }
  for (const stale of staleReferences) {
    if (html.includes(stale)) errors.push(`${rel}: stale reference ${stale}`);
  }
  const ogImages = [...html.matchAll(/<meta property="og:image" content="([^"]+)">/gu)].map((match) => match[1]);
  const twitterImages = [...html.matchAll(/<meta name="twitter:image" content="([^"]+)">/gu)].map((match) => match[1]);
  if (ogImages.length !== 1) errors.push(`${rel}: expected one og:image`);
  if (twitterImages.length !== 1) errors.push(`${rel}: expected one twitter:image`);
  if (ogImages[0]) previewReferences.add(ogImages[0]);
  if (ogImages[0] !== twitterImages[0]) errors.push(`${rel}: Open Graph and Twitter images differ`);
  for (const pattern of banned) if (pattern.test(html)) errors.push(`${rel}: banned text ${pattern}`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/gu)].map((match) => match[1]);
  if (new Set(ids).size !== ids.length) errors.push(`${rel}: duplicate id`);
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/gu)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|#)/u.test(target)) continue;
    const clean = target.split(/[?#]/u)[0];
    const resolved = clean.startsWith("/") ? path.join(root, clean) : path.resolve(path.dirname(file), clean);
    const candidate = clean.endsWith("/") ? path.join(resolved, "index.html") : resolved;
    try {
      await access(candidate);
    } catch {
      errors.push(`${rel}: broken local reference ${target}`);
    }
  }
}

for (const route of routes) {
  try {
    await access(path.join(root, route.output));
  } catch {
    errors.push(`missing generated page ${route.output}`);
  }
}
if (previewReferences.size !== 1 || !previewReferences.has(previewImageUrl)) {
  errors.push(`generated pages do not use one consistent preview image: ${[...previewReferences].join(", ")}`);
}

const contact = await readFile(path.join(root, "contact.html"), "utf8");
for (const text of ["Luca Pacini", "Individual applicant and operator of FortMilo Lab", "Harpenden, Hertfordshire, United Kingdom", "info@fortmilo.co.uk", "FortMilo Lab is an independent personal project and brand operated by Luca Pacini."]) {
  if (!contact.includes(text)) errors.push(`contact.html: missing ${text}`);
}
for (const required of ["privacy.html", "terms.html", "site.webmanifest"]) {
  try {
    await access(path.join(root, required));
  } catch {
    errors.push(`missing ${required}`);
  }
}

const preview = await readRequired(previewImagePath.slice(1));
if (preview) {
  try {
    const jpeg = parseJpeg(preview, previewImagePath);
    if (jpeg.marker !== 0xc0) errors.push(`${previewImagePath}: expected baseline JPEG SOF0`);
    if (jpeg.width !== 1200 || jpeg.height !== 630) errors.push(`${previewImagePath}: expected 1200x630 JPEG`);
    if (jpeg.components !== 3) errors.push(`${previewImagePath}: expected three JPEG colour components`);
    if (preview.length >= 500000) errors.push(`${previewImagePath}: expected file size below 500 KB`);
  } catch (error) {
    errors.push(error.message);
  }
}

const pngExpectations = new Map([
  ["apple-touch-icon.png", [180, 180]],
  ["favicon-16x16.png", [16, 16]],
  ["favicon-32x32.png", [32, 32]],
  ["assets/fortmilo-lab-brand-banner-master.png", [1536, 1024]],
  ["assets/favicon-192.png", [192, 192]],
  ["assets/favicon-512.png", [512, 512]]
]);
for (const [relativePath, [expectedWidth, expectedHeight]] of pngExpectations) {
  const buffer = await readRequired(relativePath);
  if (!buffer) continue;
  try {
    const png = parsePng(buffer, relativePath);
    if (png.width !== expectedWidth || png.height !== expectedHeight) {
      errors.push(`${relativePath}: expected ${expectedWidth}x${expectedHeight} PNG`);
    }
  } catch (error) {
    errors.push(error.message);
  }
}

const brandBanner = await readRequired(brandBannerPath.slice(1));
if (brandBanner && createHash("sha256").update(brandBanner).digest("hex") !== approvedBrandBannerSha256) {
  errors.push(`${brandBannerPath}: does not match the approved governance master`);
}

const icoBuffer = await readRequired("favicon.ico");
if (icoBuffer) {
  try {
    const icoSizes = parseIco(icoBuffer, "favicon.ico");
    for (const size of ["16x16", "32x32", "48x48"]) {
      if (!icoSizes.has(size)) errors.push(`favicon.ico: missing ${size} entry`);
    }
  } catch (error) {
    errors.push(error.message);
  }
}

const manifestBuffer = await readRequired("site.webmanifest");
if (manifestBuffer) {
  try {
    const manifest = JSON.parse(manifestBuffer.toString("utf8"));
    if (manifest.background_color !== "#07101d") errors.push("site.webmanifest: incorrect background_color");
    if (manifest.theme_color !== "#07101d") errors.push("site.webmanifest: incorrect theme_color");
    if (!Array.isArray(manifest.icons)) {
      errors.push("site.webmanifest: missing icons");
    } else {
      const manifestSizes = new Set();
      for (const icon of manifest.icons) {
        if (typeof icon.src !== "string" || !icon.src.startsWith("/")) {
          errors.push("site.webmanifest: icon path must be root-relative");
          continue;
        }
        if (icon.type !== "image/png") errors.push(`site.webmanifest: ${icon.src} must declare image/png`);
        const sizeMatch = /^(\d+)x(\d+)$/u.exec(icon.sizes || "");
        if (!sizeMatch) {
          errors.push(`site.webmanifest: invalid size for ${icon.src}`);
          continue;
        }
        const relativePath = icon.src.slice(1);
        const buffer = await readRequired(relativePath);
        if (!buffer) continue;
        try {
          const png = parsePng(buffer, relativePath);
          const expectedWidth = Number(sizeMatch[1]);
          const expectedHeight = Number(sizeMatch[2]);
          if (png.width !== expectedWidth || png.height !== expectedHeight) {
            errors.push(`site.webmanifest: ${icon.src} size does not match actual PNG`);
          }
          manifestSizes.add(`${expectedWidth}x${expectedHeight}`);
        } catch (error) {
          errors.push(error.message);
        }
      }
      for (const size of ["192x192", "512x512"]) {
        if (!manifestSizes.has(size)) errors.push(`site.webmanifest: missing ${size} icon`);
      }
    }
  } catch (error) {
    errors.push(`site.webmanifest: invalid JSON (${error.message})`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Validated ${htmlFiles.length} HTML files, approved brand artwork, social metadata, icons and manifest with no errors.`);
