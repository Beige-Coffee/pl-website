import fs from "node:fs";
import { type Server } from "node:http";
import path from "node:path";

import express, { type Express, type Request } from "express";

import runApp from "./app";

export async function serveStatic(app: Express, server: Server) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  const ogOverrides: Record<string, { title: string; description: string; image?: string }> = {
    "/noise-tutorial": {
      title: "Programming Lightning: Noise Protocol Tutorial",
      description: "An approachable deep dive into Lightning's Noise Protocol. Interactive tutorial covering cryptographic foundations, the three-act handshake, and encrypted messaging.",
      image: "https://programminglightning.com/og-image.png",
    },
  };

  // fall through to index.html if the file doesn't exist
  app.use("*", (req, res) => {
    const htmlPath = path.resolve(distPath, "index.html");
    const override = ogOverrides[req.originalUrl.split("?")[0]];

    if (!override) {
      return res.sendFile(htmlPath);
    }

    // Read HTML and replace OG tags for this route
    let html = fs.readFileSync(htmlPath, "utf-8");
    const { title, description, image } = override;
    const ogImage = image || "https://programminglightning.com/og-home.png";

    html = html
      .replace(/(<meta property="og:title" content=")([^"]*)(")/, `$1${title}$3`)
      .replace(/(<meta property="og:description" content=")([^"]*)(")/, `$1${description}$3`)
      .replace(/(<meta property="og:image" content=")([^"]*)(")/, `$1${ogImage}$3`)
      .replace(/(<meta name="twitter:title" content=")([^"]*)(")/, `$1${title}$3`)
      .replace(/(<meta name="twitter:description" content=")([^"]*)(")/, `$1${description}$3`)
      .replace(/(<meta name="twitter:image" content=")([^"]*)(")/, `$1${ogImage}$3`);

    res.type("html").send(html);
  });
}

(async () => {
  await runApp(serveStatic);
})();
