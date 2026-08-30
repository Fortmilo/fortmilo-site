import { createReadStream } from "node:fs";
import { lstat, readFile, realpath } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configuredRoot = path.resolve(repositoryRoot, "_site");
const host = process.env.PUBLICATION_HOST || "127.0.0.1";
const port = Number(process.env.PUBLICATION_PORT || "4173");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"]
]);

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`invalid PUBLICATION_PORT: ${port}`);
const artifactRoot = await realpath(configuredRoot);
if (artifactRoot !== configuredRoot || path.dirname(artifactRoot) !== repositoryRoot) {
  throw new Error(`refusing to serve an unsafe publication root: ${configuredRoot}`);
}
const rootMetadata = await lstat(artifactRoot);
if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) throw new Error("_site must be a real directory");

async function safeFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/") || decoded.includes("\\") || decoded.includes("\0")) return null;

  let relative = decoded.slice(1);
  if (!relative || decoded.endsWith("/")) relative += "index.html";
  const segments = relative.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;

  let candidate = artifactRoot;
  for (let index = 0; index < segments.length; index += 1) {
    candidate = path.join(candidate, segments[index]);
    let metadata;
    try {
      metadata = await lstat(candidate);
    } catch {
      return null;
    }
    if (metadata.isSymbolicLink()) return null;
    if (index < segments.length - 1 && !metadata.isDirectory()) return null;
    if (index === segments.length - 1 && !metadata.isFile()) return null;
  }

  const relativeToRoot = path.relative(artifactRoot, candidate);
  if (!relativeToRoot || relativeToRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToRoot)) return null;
  return candidate;
}

async function sendNotFound(response, headOnly) {
  let body = Buffer.from("Not found\n", "utf8");
  try {
    body = await readFile(path.join(artifactRoot, "404.html"));
  } catch {
    // The fallback remains a genuine HTTP 404 even if the branded page is unavailable.
  }
  response.writeHead(404, {
    "Content-Length": body.byteLength,
    "Content-Type": "text/html; charset=utf-8"
  });
  response.end(headOnly ? undefined : body);
}

const server = http.createServer(async (request, response) => {
  try {
    const headOnly = request.method === "HEAD";
    if (request.method !== "GET" && !headOnly) {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }

    const pathname = new URL(request.url || "/", `http://${host}:${port}`).pathname;
    const file = await safeFile(pathname);
    if (!file) {
      await sendNotFound(response, headOnly);
      return;
    }

    const metadata = await lstat(file);
    response.writeHead(200, {
      "Content-Length": metadata.size,
      "Content-Type": contentTypes.get(path.extname(file).toLowerCase()) || "application/octet-stream"
    });
    if (headOnly) response.end();
    else createReadStream(file).pipe(response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`Publication server error: ${error.message}\n`);
  }
});

server.listen(port, host, () => {
  console.log(`Serving allow-listed publication artifact at http://${host}:${port}/`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
