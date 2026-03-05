"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupVite = setupVite;
const vite_1 = require("vite");
const vite_config_1 = __importDefault(require("./vite.config"));
const viteLogger = (0, vite_1.createLogger)();
async function setupVite(server, app) {
    const serverOptions = {
        middlewareMode: true,
        hmr: { server, path: "/vite-hmr" },
        allowedHosts: true,
    };
    const vite = await (0, vite_1.createServer)({
        ...vite_config_1.default,
        configFile: false,
        customLogger: {
            ...viteLogger,
            error: (msg, options) => {
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
        }
        catch (e) {
            vite.ssrFixStacktrace(e);
            next(e);
        }
    });
}
//# sourceMappingURL=vite-setup.js.map