"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertTransactionSchema = exports.insertCustomerSchema = exports.insertUserSchema = exports.transactionsRelations = exports.customersRelations = exports.transactions = exports.customers = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_zod_1 = require("drizzle-zod");
const zod_1 = require("zod");
const drizzle_orm_1 = require("drizzle-orm");
// === TABLE DEFINITIONS ===
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.text)("id").primaryKey(), // UUID String
    businessName: (0, pg_core_1.text)("business_name").notNull(),
    pinHash: (0, pg_core_1.text)("pin_hash").notNull(),
    storageUsed: (0, pg_core_1.bigint)("storage_used", { mode: 'number' }).default(0), // Bytes
    storageLimit: (0, pg_core_1.bigint)("storage_limit", { mode: 'number' }).default(15 * 1024 * 1024 * 1024), // 15GB default
    lastBusinessNameChange: (0, pg_core_1.timestamp)("last_business_name_change"),
    email: (0, pg_core_1.text)("email").unique(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.customers = (0, pg_core_1.pgTable)("customers", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    phoneNumber: (0, pg_core_1.text)("phone_number").notNull(),
    network: (0, pg_core_1.text)("network").notNull().default("MTN MoMo"), // MTN, TELECEL, AIRTELTIGO
    userId: (0, pg_core_1.text)("user_id").references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
}, (table) => ({
    unq: (0, drizzle_orm_1.sql) `UNIQUE(${table.phoneNumber}, ${table.network}, ${table.userId})`
}));
exports.transactions = (0, pg_core_1.pgTable)("transactions", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    date: (0, pg_core_1.text)("date").notNull(), // YYYY-MM-DD
    time: (0, pg_core_1.text)("time").notNull(), // HH:MM
    type: (0, pg_core_1.text)("type").notNull(), // Cash In, Cash Out, etc.
    amount: (0, pg_core_1.decimal)("amount", { precision: 12, scale: 2 }).notNull(),
    fee: (0, pg_core_1.decimal)("fee", { precision: 12, scale: 2 }).default("0"),
    notes: (0, pg_core_1.text)("notes").notNull().default(""),
    customerId: (0, pg_core_1.integer)("customer_id").references(() => exports.customers.id),
    userId: (0, pg_core_1.text)("user_id").references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
// === RELATIONS ===
exports.customersRelations = (0, drizzle_orm_1.relations)(exports.customers, ({ many }) => ({
    transactions: many(exports.transactions),
}));
exports.transactionsRelations = (0, drizzle_orm_1.relations)(exports.transactions, ({ one }) => ({
    customer: one(exports.customers, {
        fields: [exports.transactions.customerId],
        references: [exports.customers.id],
    }),
    user: one(exports.users, {
        fields: [exports.transactions.userId],
        references: [exports.users.id],
    }),
}));
// === BASE SCHEMAS ===
exports.insertUserSchema = (0, drizzle_zod_1.createInsertSchema)(exports.users).omit({ id: true, createdAt: true, storageUsed: true, storageLimit: true, lastBusinessNameChange: true });
exports.insertCustomerSchema = (0, drizzle_zod_1.createInsertSchema)(exports.customers).omit({ id: true, createdAt: true, userId: true });
// Explicit transaction schema to match frontend and avoid drizzle-zod inference issues
exports.insertTransactionSchema = zod_1.z.object({
    date: zod_1.z.string(), // YYYY-MM-DD
    time: zod_1.z.string(), // HH:MM
    type: zod_1.z.string(), // Cash In, Cash Out, etc.
    amount: zod_1.z.coerce.number().or(zod_1.z.string()),
    fee: zod_1.z.coerce.number().or(zod_1.z.string()).optional().default(0),
    notes: zod_1.z.string().optional().default(""),
    network: zod_1.z.enum(["MTN MoMo", "Telecel Cash", "AirtelTigo Money"]),
});
//# sourceMappingURL=schema.js.map