"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.DatabaseStorage = void 0;
const db_1 = require("./db");
const schema_1 = require("./shared/schema");
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = require("crypto");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
class DatabaseStorage {
    async getUser(id) {
        const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
        return user;
    }
    async getUserByBusinessName(name) {
        const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.businessName, name));
        return user;
    }
    async getUserByEmail(email) {
        const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        return user;
    }
    async getFirstUser() {
        const [user] = await db_1.db.select().from(schema_1.users).limit(1);
        return user;
    }
    async createUser(user) {
        const id = (0, crypto_1.randomUUID)();
        const pinHash = await bcryptjs_1.default.hash(user.pinHash, 10); // user.pinHash is actually the plain pin here from setup
        const [newUser] = await db_1.db.insert(schema_1.users).values({
            id,
            businessName: user.businessName,
            pinHash,
            email: user.email,
            createdAt: new Date(),
            storageUsed: 0,
            storageLimit: 15 * 1024 * 1024 * 1024,
        }).returning();
        return newUser;
    }
    async updateBusinessName(userId, newName) {
        const [updatedUser] = await db_1.db.update(schema_1.users)
            .set({
            businessName: newName,
            lastBusinessNameChange: new Date()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
            .returning();
        return updatedUser;
    }
    async updatePin(userId, newPinHash) {
        const [updatedUser] = await db_1.db.update(schema_1.users)
            .set({ pinHash: newPinHash })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
            .returning();
        return updatedUser;
    }
    async validatePin(userId, pin) {
        const user = await this.getUser(userId);
        if (!user)
            return false;
        return bcryptjs_1.default.compare(pin, user.pinHash);
    }
    async getCustomer(id) {
        if (isNaN(id)) {
            console.warn(`[Storage] getCustomer called with NaN`);
            return undefined;
        }
        const [customer] = await db_1.db.select().from(schema_1.customers).where((0, drizzle_orm_1.eq)(schema_1.customers.id, id));
        return customer;
    }
    async getCustomerByPhone(phone, userId) {
        const trimmedPhone = phone.trim();
        const [customer] = await db_1.db.select().from(schema_1.customers).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.customers.phoneNumber, trimmedPhone), (0, drizzle_orm_1.eq)(schema_1.customers.userId, userId)));
        return customer;
    }
    async getCustomerByPhoneAndNetwork(phone, network, userId) {
        const trimmedPhone = phone.trim();
        const [customer] = await db_1.db.select().from(schema_1.customers).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.customers.phoneNumber, trimmedPhone), (0, drizzle_orm_1.eq)(schema_1.customers.network, network), (0, drizzle_orm_1.eq)(schema_1.customers.userId, userId)));
        return customer;
    }
    async createCustomer(customer, userId) {
        const [newCustomer] = await db_1.db.insert(schema_1.customers).values({
            ...customer,
            phoneNumber: customer.phoneNumber.trim(),
            userId,
            createdAt: new Date(),
        }).returning();
        return newCustomer;
    }
    async getCustomers(userId, search) {
        const conditions = [(0, drizzle_orm_1.eq)(schema_1.customers.userId, userId)];
        if (search) {
            conditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.customers.name, `%${search}%`), (0, drizzle_orm_1.ilike)(schema_1.customers.phoneNumber, `%${search}%`)));
        }
        return db_1.db.select().from(schema_1.customers)
            .where((0, drizzle_orm_1.and)(...conditions))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.customers.createdAt));
    }
    async getTransactions(userId, params) {
        let query = db_1.db.select({
            id: schema_1.transactions.id,
            date: schema_1.transactions.date,
            time: schema_1.transactions.time,
            type: schema_1.transactions.type,
            amount: schema_1.transactions.amount,
            fee: schema_1.transactions.fee,
            notes: schema_1.transactions.notes,
            customerId: schema_1.transactions.customerId,
            userId: schema_1.transactions.userId,
            createdAt: schema_1.transactions.createdAt,
            customer: schema_1.customers
        }).from(schema_1.transactions)
            .leftJoin(schema_1.customers, (0, drizzle_orm_1.eq)(schema_1.transactions.customerId, schema_1.customers.id));
        const conditions = [(0, drizzle_orm_1.eq)(schema_1.transactions.userId, userId)];
        if (params?.type && params.type !== 'All') {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.transactions.type, params.type));
        }
        if (params?.startDate) {
            conditions.push((0, drizzle_orm_1.gte)(schema_1.transactions.date, params.startDate));
        }
        if (params?.endDate) {
            conditions.push((0, drizzle_orm_1.lte)(schema_1.transactions.date, params.endDate));
        }
        if (params?.search) {
            conditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.customers.name, `%${params.search}%`), (0, drizzle_orm_1.ilike)(schema_1.customers.phoneNumber, `%${params.search}%`)));
        }
        // Always valid because we init with userId condition
        query = query.where((0, drizzle_orm_1.and)(...conditions));
        return (await query.orderBy((0, drizzle_orm_1.desc)(schema_1.transactions.date), (0, drizzle_orm_1.desc)(schema_1.transactions.time)));
    }
    async createTransaction(tx, userId) {
        // Find or create customer by phone AND network
        let customer = await this.getCustomerByPhoneAndNetwork(tx.phoneNumber, tx.network, userId);
        if (!customer) {
            customer = await this.createCustomer({
                name: tx.customerName,
                phoneNumber: tx.phoneNumber,
                network: tx.network,
            }, userId);
        }
        // Prepare values for database insertion
        const [newTx] = await db_1.db.insert(schema_1.transactions).values({
            type: tx.type,
            amount: String(tx.amount), // Ensure string for decimal(12, 2)
            fee: tx.fee !== undefined ? String(tx.fee) : "0",
            date: tx.date,
            time: tx.time,
            notes: tx.notes || "",
            customerId: customer.id,
            userId: userId,
            createdAt: new Date(),
        }).returning();
        return newTx;
    }
    async deleteTransaction(id) {
        await db_1.db.delete(schema_1.transactions).where((0, drizzle_orm_1.eq)(schema_1.transactions.id, id));
    }
    async getDashboardStats(userId) {
        const today = new Date().toISOString().split('T')[0];
        const todaysTx = await db_1.db.select().from(schema_1.transactions).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.transactions.date, today), (0, drizzle_orm_1.eq)(schema_1.transactions.userId, userId)));
        const allTx = await db_1.db.select().from(schema_1.transactions).where((0, drizzle_orm_1.eq)(schema_1.transactions.userId, userId));
        const stats = {
            todayCount: todaysTx.length,
            totalCashIn: 0,
            totalCashOut: 0,
            totalFees: 0,
            netProfit: 0,
        };
        allTx.forEach(tx => {
            const amount = Number(tx.amount);
            const fee = Number(tx.fee || 0);
            if (tx.type === 'Cash In')
                stats.totalCashIn += amount;
            if (tx.type === 'Cash Out')
                stats.totalCashOut += amount;
            stats.totalFees += fee;
        });
        stats.netProfit = stats.totalFees; // Simplified profit model
        return stats;
    }
    async updateStorageUsage(userId, bytes) {
        await db_1.db.update(schema_1.users).set({ storageUsed: bytes }).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
    }
    async migrateOrphanedCustomers() {
        // 1. Find customers with no userId
        const orphanedCustomers = await db_1.db.select().from(schema_1.customers).where((0, drizzle_orm_1.sql) `${schema_1.customers.userId} IS NULL`);
        for (const customer of orphanedCustomers) {
            // 2. Find any transaction for this customer to determine the owner
            const [tx] = await db_1.db.select().from(schema_1.transactions).where((0, drizzle_orm_1.eq)(schema_1.transactions.customerId, customer.id)).limit(1);
            if (tx && tx.userId) {
                // 3. Update customer with the transaction's userId
                await db_1.db.update(schema_1.customers).set({ userId: tx.userId }).where((0, drizzle_orm_1.eq)(schema_1.customers.id, customer.id));
                console.log(`[MIGRATION] Migration: Linked customer ${customer.name} to user ${tx.userId}`);
            }
        }
    }
}
exports.DatabaseStorage = DatabaseStorage;
exports.storage = new DatabaseStorage();
//# sourceMappingURL=storage.js.map