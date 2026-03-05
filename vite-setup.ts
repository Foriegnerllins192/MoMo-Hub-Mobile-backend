import { type Express } from "express";
import { createServer as createViteServer, createLogger, type LogOptions } from "vite";
import { type Server } from "http";
import viteConfig from "./vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg: string, options?: LogOptions) => {
        viteLogger.error(msg, options);
        // Don't exit process in production
        if (process.env.NODE_ENV !== "production") {
          process.exit(1);
        }
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      // Create a basic HTML template since we don't have a client directory
      const template = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>API Server</title>
  </head>
  <body>
    <div id="root">
      <h1>API Server Running</h1>
      <p>This is a backend API server. Use the API endpoints to interact with the service.</p>
      <p>Health check: <a href="/health">/health</a></p>
    </div>
  </body>
</html>`;

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}