import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * Dev-only endpoints for the pipeline inspector: read and write hand-reviewed
 * expectations in fixtures/<stage>/<slug>.json. Pipeline outputs under data/
 * are served as static files by Vite itself.
 */
function fixtures(): Plugin {
  const root = path.resolve("fixtures");
  const NAME = /^[a-z0-9-]+$/;
  return {
    name: "fixtures",
    configureServer(server) {
      server.middlewares.use("/api/fixtures", (req, res) => {
        const [, stage, slug] = (req.url ?? "").split("/");
        if (!NAME.test(stage ?? "") || !NAME.test(slug ?? "")) {
          res.statusCode = 400;
          return res.end("bad fixture path");
        }
        const file = path.join(root, stage, `${slug}.json`);
        if (req.method === "GET") {
          res.setHeader("content-type", "application/json");
          return res.end(fs.existsSync(file) ? fs.readFileSync(file) : "{}");
        }
        if (req.method === "PUT") {
          let body = "";
          req.on("data", (c) => (body += c));
          req.on("end", () => {
            JSON.parse(body); // reject malformed writes
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, JSON.stringify(JSON.parse(body), null, 1) + "\n");
            res.end("ok");
          });
          return;
        }
        res.statusCode = 405;
        res.end();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), fixtures()],
});
