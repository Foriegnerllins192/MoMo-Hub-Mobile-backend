import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root explicitly
dotenv.config({ path: path.join(process.cwd(), '..', '.env') });

if (!process.env.DATABASE_URL) {
    console.error("CRITICAL: DATABASE_URL is missing in .env");
    throw new Error("DATABASE_URL is not set in environment variables. Check your .env file at the project root.");
}

/**
 * Reusable Pool instance for Neon PostgreSQL
 * SSL is enabled and configured for production-safe cloud connections
 */
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false, // Required for Neon
    },
});

// Error handling for database connection failures
pool.on('error', (err: any) => {
    console.error('Unexpected error on idle database client', err);
    process.exit(-1);
});

export const db = drizzle(pool, { schema });

// Export pool for direct query access (e.g., health checks)
export default pool;
