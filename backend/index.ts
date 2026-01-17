import "dotenv/config";
console.log("====================================================");
console.log("=== SERVER STARTING UP - UNIQUE ID: START_001 ===");
console.log("====================================================");
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import cors from "cors";

const app = express();
app.use(cors({
  origin: true,
  credentials: true
}));
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Global request logging for debugging
  if (req.method === 'POST' && path.startsWith('/api')) {
    log(`[DEBUG_ENTRY] Incoming POST to ${path} - Type: ${req.headers['content-type']}`);
  }

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      // Also log body if available at finish
      if (req.method === 'POST' && req.body && Object.keys(req.body).length > 0) {
        logLine += ` | Request Body: ${JSON.stringify(req.body)}`;
      }

      log(logLine);
    }
  });

  next();
});

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}



// Diagnostic route - no auth required, just to test body parser
app.post('/api/diag/echo', (req, res) => {
  res.json({
    receivedBody: req.body,
    contentType: req.headers['content-type'],
    hasBody: !!req.body && Object.keys(req.body).length > 0
  });
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (err instanceof SyntaxError && status === 400 && 'body' in err) {
      log(`JSON Parsing Error: ${err.message}`);
      return res.status(400).json({ message: "Invalid JSON in request body", detail: err.message });
    }

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      // reusePort: true, // Not supported on Windows
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
