"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = log;
require("dotenv/config");
console.log("====================================================");
console.log("=== SERVER STARTING UP - UNIQUE ID: START_001 ===");
console.log("====================================================");
const express_1 = __importDefault(require("express"));
const routes_1 = require("./routes");
const http_1 = require("http");
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: "*", // Allow all origins for mobile app access
    credentials: false // Set to false when using origin: "*"
}));
const httpServer = (0, http_1.createServer)(app);
app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse = undefined;
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
app.use(express_1.default.json({
    verify: (req, _res, buf) => {
        req.rawBody = buf;
    },
}));
app.use(express_1.default.urlencoded({ extended: false }));
function log(message, source = "express") {
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
// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        port: process.env.PORT || '5000'
    });
});
(async () => {
    await (0, routes_1.registerRoutes)(httpServer, app);
    app.use((err, _req, res, _next) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        if (err instanceof SyntaxError && status === 400 && 'body' in err) {
            log(`JSON Parsing Error: ${err.message}`);
            return res.status(400).json({ message: "Invalid JSON in request body", detail: err.message });
        }
        res.status(status).json({ message });
        throw err;
    });
    // API-only mode - no frontend serving needed
    // Frontend removed, only serving API endpoints
    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen({
        port,
        host: "0.0.0.0",
        // reusePort: true, // Not supported on Windows
    }, () => {
        console.log(`Server running on port ${port}`);
        log(`serving on port ${port}`);
    });
})();
//# sourceMappingURL=index.js.map