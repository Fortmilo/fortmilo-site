import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";

const freezeAsset = (asset) => Object.freeze({ ...asset, dimensions: asset.dimensions ? Object.freeze(asset.dimensions) : undefined });

export const governedAssets = Object.freeze([
  freezeAsset({ path: "apple-touch-icon.png", sha256: "b0d934915f33b3431f68781f6443d3057c50e614012de0acc7b5e841c142856a", bytes: 28689, mediaType: "image/png", signature: "89504e470d0a1a0a", dimensions: { width: 180, height: 180 }, purpose: "Apple touch icon" }),
  freezeAsset({ path: "favicon-16x16.png", sha256: "6b754e63f6a325bca39f6d58e4e4123542c59820bb1749b7833083ead72c3acf", bytes: 637, mediaType: "image/png", signature: "89504e470d0a1a0a", dimensions: { width: 16, height: 16 }, purpose: "16 px browser favicon" }),
  freezeAsset({ path: "favicon-32x32.png", sha256: "8ba07be74b5a7cfbf5f23467376c0078bd32f6eb3a59ce7b0e098ce4a5e90029", bytes: 1720, mediaType: "image/png", signature: "89504e470d0a1a0a", dimensions: { width: 32, height: 32 }, purpose: "32 px browser favicon" }),
  freezeAsset({ path: "favicon-48x48.png", sha256: "0a924eab674dbb5db3f65cd896603cee3aa917acb501b752a4ec40987b4550a8", bytes: 3071, mediaType: "image/png", signature: "89504e470d0a1a0a", dimensions: { width: 48, height: 48 }, purpose: "48 px browser favicon" }),
  freezeAsset({ path: "favicon.ico", sha256: "bd2f5e21de591691571aaa2bd8b71a251fdb4edb540c2ce27a3ad14a300e537c", bytes: 5495, mediaType: "image/x-icon", signature: "00000100", purpose: "Multi-size browser favicon" }),
  freezeAsset({ path: "favicon.svg", sha256: "e036914c427763f5d1f7ec4368c2e7f51324ab194c9f2d03142a20adb8e4968b", bytes: 301035, mediaType: "image/svg+xml", signature: "svg-root", purpose: "Scalable browser favicon" }),
  freezeAsset({ path: "mstile-150x150.png", sha256: "4417d9367cad3ab2e9949d1bca38646115ef9bea3db4c8976b48752963d5929f", bytes: 20305, mediaType: "image/png", signature: "89504e470d0a1a0a", dimensions: { width: 150, height: 150 }, purpose: "Microsoft tile icon" }),
  freezeAsset({ path: "assets/android-chrome-192x192.png", sha256: "5af19460703089a8ff214413844aeafeb62920529b13ced37315dd56ccdf9661", bytes: 32631, mediaType: "image/png", signature: "89504e470d0a1a0a", dimensions: { width: 192, height: 192 }, purpose: "Android Chrome icon" }),
  freezeAsset({ path: "assets/android-chrome-512x512.png", sha256: "c194e9a1687190110b2bce2e2ceeefac97bb5c8ff050df53a9e0197c601502a8", bytes: 225569, mediaType: "image/png", signature: "89504e470d0a1a0a", dimensions: { width: 512, height: 512 }, purpose: "Android Chrome icon" }),
  freezeAsset({ path: "assets/fortmilo-brand-banner-1200x675.png", sha256: "32b04b9285fd0399a9492a769a403485cf03ec20c1eb70949b8da55ffd6702e1", bytes: 1298517, mediaType: "image/png", signature: "89504e470d0a1a0a", dimensions: { width: 1200, height: 675 }, purpose: "Homepage header brand mark" }),
  freezeAsset({ path: "assets/fortmilo-security-observatory-og-20260731.jpg", sha256: "613ed0583c4d9860252ec142dfcbe76201ef92bc63f3e60e514ca573019c743b", bytes: 93262, mediaType: "image/jpeg", signature: "ffd8-ffd9", dimensions: { width: 1200, height: 630 }, purpose: "Open Graph and Twitter social preview" }),
  freezeAsset({ path: "assets/fortmilo-shield-512.png", sha256: "a39acef2c9e9dc76583ed60b4c4c1e59fe92c135a6295683edf080051d0fa980", bytes: 217630, mediaType: "image/png", signature: "89504e470d0a1a0a", dimensions: { width: 512, height: 512 }, purpose: "Shared header brand mark and organization logo" }),
  freezeAsset({ path: "assets/security-observatory-external-connections-oauth.webp", sha256: "d2d261559009a946987cdc73e5b740ab6f1b3d89b9014ba224956bc785a4bdb9", bytes: 109902, mediaType: "image/webp", signature: "RIFF-WEBP-VP8", dimensions: { width: 1600, height: 1491 }, purpose: "External Connections product screenshot" }),
  freezeAsset({ path: "assets/security-observatory-finding-review.webp", sha256: "f1e2b6a639a5aaf4ce46765ccead9c22282c3779eebdf56a9858d0f77f305f8f", bytes: 69210, mediaType: "image/webp", signature: "RIFF-WEBP-VP8", dimensions: { width: 1600, height: 1266 }, purpose: "Finding review product screenshot" }),
  freezeAsset({ path: "assets/security-observatory-governance-context.webp", sha256: "680293b8af17a989ce40c0b4e5d1ad4792d17eb5ae75703295ab6175625018a0", bytes: 40070, mediaType: "image/webp", signature: "RIFF-WEBP-VP8", dimensions: { width: 1545, height: 1060 }, purpose: "Governed application context product screenshot" }),
  freezeAsset({ path: "assets/security-observatory-overview.webp", sha256: "5525387104f4d50532bc2f4749636236c66b0855b183690c3d79cc2fe7a138d3", bytes: 52282, mediaType: "image/webp", signature: "RIFF-WEBP-VP8", dimensions: { width: 1600, height: 766 }, purpose: "Security Observatory overview product screenshot" }),
  freezeAsset({ path: "assets/security-observatory-sbs-supporting-evidence.webp", sha256: "52e9d0b17b775e12f01bab347864447be816141c5e6b6d8eb12d9fd48cde9624", bytes: 143248, mediaType: "image/webp", signature: "RIFF-WEBP-VP8", dimensions: { width: 1420, height: 1585 }, purpose: "SBS supporting evidence product screenshot" })
]);

export const socialPreviewAsset = governedAssets.find((asset) => asset.purpose.includes("social preview"));

export const staleGovernedAssetPaths = Object.freeze([
  "assets/fortmilo-salesforce-partner-home.png",
  "assets/fortmilo-security-observatory-og-20260730.jpg",
  "assets/fortmilo-security-observatory-og-v2.png",
  "assets/fortmilo-security-observatory-og.png",
  "assets/security-observatory-navigation.png",
  "assets/favicon-192.png",
  "assets/favicon-512.png",
  "assets/apple-touch-icon.png",
  "assets/favicon-32.png",
  "assets/fortmilo-brand-banner-1200x675.jpg",
  "fortmilo-logo.svg"
]);

const pngSignature = Buffer.from("89504e470d0a1a0a", "hex");
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

export function parsePng(buffer, label = "PNG") {
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

  let sourceOffset = 0;
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
    if (channels === 4) {
      for (let column = 3; column < rowBytes; column += channels) minimumAlpha = Math.min(minimumAlpha, current[column]);
    }
    previous = current;
  }
  return { width, height, colourType, actualTransparency: minimumAlpha < 255 };
}

export function parseJpeg(buffer, label = "JPEG") {
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
      frame = { marker, height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5), components: buffer[offset + 7] };
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
  if (!sawScan || !sawEnd || offset !== buffer.length) throw new Error(`${label}: incomplete JPEG structure`);
  return frame;
}

export function parseWebp(buffer, label = "WebP") {
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error(`${label}: invalid WebP RIFF signature`);
  }
  if (buffer.readUInt32LE(4) + 8 !== buffer.length) throw new Error(`${label}: invalid WebP RIFF length`);
  if (buffer.toString("ascii", 12, 16) !== "VP8 ") throw new Error(`${label}: expected lossy VP8 WebP`);
  const chunkLength = buffer.readUInt32LE(16);
  const paddedChunkEnd = 20 + chunkLength + (chunkLength % 2);
  if (chunkLength < 10 || paddedChunkEnd !== buffer.length) throw new Error(`${label}: invalid VP8 chunk length`);
  if (buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a) throw new Error(`${label}: invalid VP8 frame signature`);
  const width = buffer.readUInt16LE(26) & 0x3fff;
  const height = buffer.readUInt16LE(28) & 0x3fff;
  if (!width || !height) throw new Error(`${label}: invalid WebP dimensions`);
  return { width, height };
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
    const parsed = parsePng(buffer.subarray(resourceOffset, resourceOffset + resourceLength), `${label} ${width}x${height}`);
    if (parsed.width !== width || parsed.height !== height) throw new Error(`${label}: ${width}x${height} directory entry does not match its PNG`);
    sizes.add(`${width}x${height}`);
  }
  for (const required of ["16x16", "32x32", "48x48"]) if (!sizes.has(required)) throw new Error(`${label}: missing ${required} entry`);
}

export function governedAssetErrors(asset, buffer) {
  const errors = [];
  if (buffer.byteLength !== asset.bytes) errors.push(`${asset.path}: expected ${asset.bytes} bytes, found ${buffer.byteLength}`);
  const digest = createHash("sha256").update(buffer).digest("hex");
  if (digest !== asset.sha256) errors.push(`${asset.path}: SHA-256 differs from governed manifest`);

  try {
    let dimensions;
    if (asset.mediaType === "image/png") {
      const parsed = parsePng(buffer, asset.path);
      dimensions = parsed;
      if (parsed.actualTransparency) errors.push(`${asset.path}: unexpected transparent pixels`);
    } else if (asset.mediaType === "image/jpeg") {
      const parsed = parseJpeg(buffer, asset.path);
      dimensions = parsed;
      if (parsed.components !== 3) errors.push(`${asset.path}: expected three JPEG colour components`);
    } else if (asset.mediaType === "image/webp") {
      dimensions = parseWebp(buffer, asset.path);
    } else if (asset.mediaType === "image/x-icon") {
      parseIco(buffer, asset.path);
    } else if (asset.mediaType === "image/svg+xml") {
      const text = buffer.toString("utf8").trimStart();
      if (!/^(?:<\?xml\b[^?]*\?>\s*)?<svg\b[^>]*xmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/u.test(text)) throw new Error(`${asset.path}: invalid SVG root signature`);
    } else {
      errors.push(`${asset.path}: unsupported governed media type ${asset.mediaType}`);
    }
    if (asset.dimensions && dimensions && (dimensions.width !== asset.dimensions.width || dimensions.height !== asset.dimensions.height)) {
      errors.push(`${asset.path}: expected ${asset.dimensions.width}x${asset.dimensions.height}, found ${dimensions.width}x${dimensions.height}`);
    }
  } catch (error) {
    errors.push(error.message);
  }

  return errors;
}
