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

  // Page-specific OG meta overrides for social-media previews
  const ogOverrides: Record<string, { title: string; description: string; image?: string }> = {
    "/noise-tutorial": {
      title: "Lightning's Noise Protocol: A Deep Dive",
      description: "A deep dive into Lightning's Noise Protocol — the encryption handshake that secures every Lightning Network connection.",
    },
    "/learn": {
      title: "Programming Lightning — An Interactive Tutorial",
      description: "An interactive tutorial covering the math, cryptography, and code behind the Lightning Network.",
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
    const ogImage = image || "https://programminglightning.com/og-image.png";

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
