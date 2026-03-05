"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.pool = void 0;
const pg_1 = __importDefault(require("pg"));
const { Pool } = pg_1.default;
const node_postgres_1 = require("drizzle-orm/node-postgres");
const schema = __importStar(require("./shared/schema"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env from project root explicitly
dotenv_1.default.config({ path: path_1.default.join(process.cwd(), '..', '.env') });
if (!process.env.DATABASE_URL) {
    console.error("CRITICAL: DATABASE_URL is missing in .env");
    throw new Error("DATABASE_URL is not set in environment variables. Check your .env file at the project root.");
}
/**
 * Reusable Pool instance for Neon PostgreSQL
 * SSL is enabled and configured for production-safe cloud connections
 */
exports.pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false, // Required for Neon
    },
});
// Error handling for database connection failures
exports.pool.on('error', (err) => {
    console.error('Unexpected error on idle database client', err);
    process.exit(-1);
});
exports.db = (0, node_postgres_1.drizzle)(exports.pool, { schema });
// Export pool for direct query access (e.g., health checks)
exports.default = exports.pool;
//# sourceMappingURL=db.js.map