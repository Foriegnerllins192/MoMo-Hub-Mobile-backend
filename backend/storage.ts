import { db } from "./db";
import { users, customers, transactions, type User, type InsertUser, type InsertCustomer, type InsertTransaction, type Customer, type Transaction } from "@shared/schema";
import { eq, ilike, and, gte, lte, desc, sql, or } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

export interface IStorage {
  // Auth
  getUser(id: string): Promise<User | undefined>;
  getUserByBusinessName(name: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getFirstUser(): Promise<User | undefined>;
  createUser(user: InsertUser & { email?: string }): Promise<User>;
  updateBusinessName(userId: string, newName: string): Promise<User>;
  updatePin(userId: string, newPinHash: string): Promise<User>;
  validatePin(userId: string, pin: string): Promise<boolean>;

  // Customers
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomerByPhone(phone: string, userId: string): Promise<Customer | undefined>;
  getCustomerByPhoneAndNetwork(phone: string, network: string, userId: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer, userId: string): Promise<Customer>;
  getCustomers(userId: string, search?: string): Promise<Customer[]>;

  // Transactions
  getTransactions(userId: string, params?: { search?: string, type?: string, startDate?: string, endDate?: string }): Promise<(Transaction & { customer: Customer | null })[]>;
  createTransaction(tx: InsertTransaction & { customerName: string, phoneNumber: string }, userId: string): Promise<Transaction>;
  deleteTransaction(id: number): Promise<void>;

  // Dashboard
  getDashboardStats(userId: string): Promise<{
    todayCount: number;
    totalCashIn: number;
    totalCashOut: number;
    totalFees: number;
    netProfit: number;
  }>;

  // Storage
  updateStorageUsage(userId: string, bytes: number): Promise<void>;
  migrateOrphanedCustomers(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByBusinessName(name: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.businessName, name));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getFirstUser(): Promise<User | undefined> {
    const [user] = await db.select().from(users).limit(1);
    return user;
  }

  async createUser(user: InsertUser & { email?: string }): Promise<User> {
    const id = randomUUID();
    const pinHash = await bcrypt.hash(user.pinHash, 10); // user.pinHash is actually the plain pin here from setup

    const [newUser] = await db.insert(users).values({
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

  async updateBusinessName(userId: string, newName: string): Promise<User> {
    const [updatedUser] = await db.update(users)
      .set({
        businessName: newName,
        lastBusinessNameChange: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async updatePin(userId: string, newPinHash: string): Promise<User> {
    const [updatedUser] = await db.update(users)
      .set({ pinHash: newPinHash })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async validatePin(userId: string, pin: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;
    return bcrypt.compare(pin, user.pinHash);
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    if (isNaN(id)) {
      console.warn(`[Storage] getCustomer called with NaN`);
      return undefined;
    }
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomerByPhone(phone: string, userId: string): Promise<Customer | undefined> {
    const trimmedPhone = phone.trim();
    const [customer] = await db.select().from(customers).where(
      and(
        eq(customers.phoneNumber, trimmedPhone),
        eq(customers.userId, userId)
      )
    );
    return customer;
  }

  async getCustomerByPhoneAndNetwork(phone: string, network: string, userId: string): Promise<Customer | undefined> {
    const trimmedPhone = phone.trim();
    const [customer] = await db.select().from(customers).where(
      and(
        eq(customers.phoneNumber, trimmedPhone),
        eq(customers.network, network),
        eq(customers.userId, userId)
      )
    );
    return customer;
  }

  async createCustomer(customer: InsertCustomer, userId: string): Promise<Customer> {
    const [newCustomer] = await db.insert(customers).values({
      ...customer,
      phoneNumber: customer.phoneNumber.trim(),
      userId,
      createdAt: new Date(),
    }).returning();
    return newCustomer;
  }

  async getCustomers(userId: string, search?: string): Promise<Customer[]> {
    const conditions = [eq(customers.userId, userId)];

    if (search) {
      conditions.push(or(
        ilike(customers.name, `%${search}%`),
        ilike(customers.phoneNumber, `%${search}%`)
      ) as any);
    }

    return db.select().from(customers)
      .where(and(...conditions))
      .orderBy(desc(customers.createdAt));
  }

  async getTransactions(userId: string, params?: { search?: string, type?: string, startDate?: string, endDate?: string }): Promise<(Transaction & { customer: Customer | null })[]> {
    let query = db.select({
      id: transactions.id,
      date: transactions.date,
      time: transactions.time,
      type: transactions.type,
      amount: transactions.amount,
      fee: transactions.fee,
      notes: transactions.notes,
      customerId: transactions.customerId,
      userId: transactions.userId,
      createdAt: transactions.createdAt,
      customer: customers
    }).from(transactions)
      .leftJoin(customers, eq(transactions.customerId, customers.id));

    const conditions = [eq(transactions.userId, userId)];

    if (params?.type && params.type !== 'All') {
      conditions.push(eq(transactions.type, params.type));
    }

    if (params?.startDate) {
      conditions.push(gte(transactions.date, params.startDate));
    }

    if (params?.endDate) {
      conditions.push(lte(transactions.date, params.endDate));
    }

    if (params?.search) {
      conditions.push(or(
        ilike(customers.name, `%${params.search}%`),
        ilike(customers.phoneNumber, `%${params.search}%`)
      ) as any);
    }

    // Always valid because we init with userId condition
    query = query.where(and(...conditions)) as any;

    return (await query.orderBy(desc(transactions.date), desc(transactions.time))) as any;
  }

  async createTransaction(tx: InsertTransaction & { customerName: string, phoneNumber: string, network: string }, userId: string): Promise<Transaction> {
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
    const [newTx] = await db.insert(transactions).values({
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

  async deleteTransaction(id: number): Promise<void> {
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  async getDashboardStats(userId: string): Promise<{ todayCount: number; totalCashIn: number; totalCashOut: number; totalFees: number; netProfit: number }> {
    const today = new Date().toISOString().split('T')[0];
    const todaysTx = await db.select().from(transactions).where(
      and(
        eq(transactions.date, today),
        eq(transactions.userId, userId)
      )
    );

    const allTx = await db.select().from(transactions).where(eq(transactions.userId, userId));

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
      if (tx.type === 'Cash In') stats.totalCashIn += amount;
      if (tx.type === 'Cash Out') stats.totalCashOut += amount;
      stats.totalFees += fee;
    });

    stats.netProfit = stats.totalFees; // Simplified profit model

    return stats;
  }

  async updateStorageUsage(userId: string, bytes: number): Promise<void> {
    await db.update(users).set({ storageUsed: bytes }).where(eq(users.id, userId));
  }

  async migrateOrphanedCustomers(): Promise<void> {
    // 1. Find customers with no userId
    const orphanedCustomers = await db.select().from(customers).where(sql`${customers.userId} IS NULL`);

    for (const customer of orphanedCustomers) {
      // 2. Find any transaction for this customer to determine the owner
      const [tx] = await db.select().from(transactions).where(eq(transactions.customerId, customer.id)).limit(1);

      if (tx && tx.userId) {
        // 3. Update customer with the transaction's userId
        await db.update(customers).set({ userId: tx.userId }).where(eq(customers.id, customer.id));
        console.log(`[MIGRATION] Migration: Linked customer ${customer.name} to user ${tx.userId}`);
      }
    }
  }
}

export const storage = new DatabaseStorage();
