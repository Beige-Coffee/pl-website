import fs from "node:fs";

// Load .env BEFORE any other imports that use process.env
try {
  if (fs.existsSync(".env")) {
    const envContent = fs.readFileSync(".env", "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
    console.log("[env] Loaded .env file");
  }
} catch {}

// Dynamic imports so process.env is set before modules read it
const { type: _Server } = await import("node:http");
const path = await import("node:path");
const { nanoid } = await import("nanoid");
const { createServer: createViteServer, createLogger } = await import("vite");
const { default: runApp } = await import("./app");
const viteConfig = (await import("../vite.config")).default;

type Server = import("node:http").Server;
type Express = import("express").Express;

const viteLogger = createLogger();

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  const ogOverrides: Record<string, { title: string; description: string; image?: string }> = {
    "/noise-tutorial": {
      title: "Programming Lightning: Noise Protocol Tutorial",
      description: "An approachable deep dive into Lightning's Noise Protocol. Interactive tutorial covering cryptographic foundations, the three-act handshake, and encrypted messaging.",
      image: "https://programminglightning.com/og-image.png",
    },
  };

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      const override = ogOverrides[url.split("?")[0]];
      if (override) {
        const { title, description, image } = override;
        const ogImage = image || "https://programminglightning.com/og-home.png";
        template = template
          .replace(/(<meta property="og:title" content=")([^"]*)(")/, `$1${title}$3`)
          .replace(/(<meta property="og:description" content=")([^"]*)(")/, `$1${description}$3`)
          .replace(/(<meta property="og:image" content=")([^"]*)(")/, `$1${ogImage}$3`)
          .replace(/(<meta name="twitter:title" content=")([^"]*)(")/, `$1${title}$3`)
          .replace(/(<meta name="twitter:description" content=")([^"]*)(")/, `$1${description}$3`)
          .replace(/(<meta name="twitter:image" content=")([^"]*)(")/, `$1${ogImage}$3`);
      }

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

(async () => {
  await runApp(setupVite);
})();
