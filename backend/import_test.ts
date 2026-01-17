
import "dotenv/config";
console.log("1. Dotenv loaded");
import express from "express";
console.log("2. Express imported");
import { registerRoutes } from "./routes";
console.log("3. Routes imported");
import { serveStatic } from "./static";
console.log("4. Static imported");
import { createServer } from "http";
console.log("5. HTTP imported");
import cors from "cors";
console.log("6. CORS imported");
console.log("All imports successful");
