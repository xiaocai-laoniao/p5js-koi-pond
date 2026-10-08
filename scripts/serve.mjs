import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".png", "image/png"],
  [".txt", "text/plain; charset=utf-8"],
]);

export function createStaticServer(root = ROOT) {
  return createServer((req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    const pathname = decodeURIComponent(url.pathname);
    const target = pathname === "/" ? "/index.html" : pathname;
    const file = normalize(join(root, target));
    if (relative(root, file).startsWith("..")) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    try {
      const info = statSync(file);
      if (!info.isFile()) throw new Error("Not a file");
      res.writeHead(200, {
        "Content-Type": MIME.get(extname(file)) || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || process.argv[2] || 4173);
  createStaticServer().listen(port, "127.0.0.1", () => {
    console.log(`p5js-koi-pond: http://127.0.0.1:${port}/`);
  });
}
