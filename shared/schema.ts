import { pgTable, text, integer, timestamp, serial, decimal, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";

// === TABLE DEFINITIONS ===

export const users = pgTable("users", {
  id: text("id").primaryKey(), // UUID String
  businessName: text("business_name").notNull(),
  pinHash: text("pin_hash").notNull(),
  storageUsed: bigint("storage_used", { mode: 'number' }).default(0), // Bytes
  storageLimit: bigint("storage_limit", { mode: 'number' }).default(15 * 1024 * 1024 * 1024), // 15GB default
  lastBusinessNameChange: timestamp("last_business_name_change"),
  email: text("email").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  network: text("network").notNull().default("MTN MoMo"), // MTN, TELECEL, AIRTELTIGO
  userId: text("user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  unq: sql`UNIQUE(${table.phoneNumber}, ${table.network}, ${table.userId})`
}));

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(), // YYYY-MM-DD
  time: text("time").notNull(), // HH:MM
  type: text("type").notNull(), // Cash In, Cash Out, etc.
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  fee: decimal("fee", { precision: 12, scale: 2 }).default("0"),
  notes: text("notes").notNull().default(""),
  customerId: integer("customer_id").references(() => customers.id),
  userId: text("user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// === RELATIONS ===

export const customersRelations = relations(customers, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  customer: one(customers, {
    fields: [transactions.customerId],
    references: [customers.id],
  }),
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

// === BASE SCHEMAS ===

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, storageUsed: true, storageLimit: true, lastBusinessNameChange: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, userId: true });

// Explicit transaction schema to match frontend and avoid drizzle-zod inference issues
export const insertTransactionSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  time: z.string(), // HH:MM
  type: z.string(), // Cash In, Cash Out, etc.
  amount: z.coerce.number().or(z.string()),
  fee: z.coerce.number().or(z.string()).optional().default(0),
  notes: z.string().optional().default(""),
  network: z.enum(["MTN MoMo", "Telecel Cash", "AirtelTigo Money"]),
});

// === EXPLICIT API CONTRACT TYPES ===

export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

// Auth
export type LoginRequest = { email: string; pin: string };
export type LoginResponse = User;

// Dashboard
export type DashboardStats = {
  todayCount: number;
  totalCashIn: number;
  totalCashOut: number;
  totalFees: number;
  netProfit: number;
};

// Backup
export type BackupMetadata = {
  id: string;
  name: string;
  size: number;
  created_at: string;
};

export type StorageStats = {
  used: number; // bytes
  limit: number; // bytes
  percentage: number;
};
