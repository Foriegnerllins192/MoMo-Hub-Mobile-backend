import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";
import { backupService } from "./backup";
import { pool } from "./db";

const SessionStore = MemoryStore(session);

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  console.log("====================================================");
  console.log("=== REGISTERING ROUTES - UNIQUE ID: ROUTES_001 ===");
  console.log("====================================================");

  // Database Health check
  app.get('/api/db-test', async (_req, res) => {
    try {
      const result = await pool.query('SELECT NOW() as time');
      res.json({
        status: 'ok',
        message: 'Database connected successfully',
        time: result.rows[0].time
      });
    } catch (err: any) {
      res.status(500).json({
        status: 'error',
        message: 'Database connection failed',
        error: err.message
      });
    }
  });

  // Run data restoration migration
  storage.migrateOrphanedCustomers().catch(err => {
    console.error("Data restoration migration failed:", err);
  });

  // Session Setup
  app.use(session({
    secret: process.env.SESSION_SECRET || 'momo-hub-secret',
    resave: false,
    saveUninitialized: false,
    store: new SessionStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      secure: false,
      sameSite: "lax"
    }
  }));

  // Helper to check auth
  const requireAuth = (req: any, res: any, next: any) => {
    // Check for explicit session or X-User-Id header (for mobile dev)
    if (!req.session.userId) {
      const authHeader = req.headers['x-user-id'];
      if (authHeader) {
        req.session.userId = authHeader as string;
        return next();
      }
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // Auth Routes
  app.post(api.auth.setup.path, async (req, res) => {
    try {
      const input = api.auth.setup.input.parse(req.body);
      const existing = await storage.getUserByBusinessName(input.businessName);
      if (existing) {
        return res.status(400).json({ message: "Business name already taken" });
      }

      // Check email uniqueness if email is provided
      if (input.email) {
        const existingEmail = await storage.getUserByEmail(input.email);
        if (existingEmail) {
          return res.status(400).json({ message: "Email already registered" });
        }
      }

      // Map pin to pinHash for creation (storage hashes it)
      const user = await storage.createUser({
        businessName: input.businessName,
        pinHash: input.pin,
        email: input.email
      });

      req.session.userId = user.id;
      res.status(201).json(user);
    } catch (err) {
      console.error("Setup failed:", err);
      res.status(400).json({ message: "SETUP_ROUTE_INVALID_INPUT" });
    }
  });

  app.post(api.auth.forgotPin.path, async (req, res) => {
    try {
      const { email } = req.body;
      const user = await storage.getUserByEmail(email);

      if (!user) {
        // Security: Don't reveal if user exists
        return res.json({ message: "If an account exists with this email, a reset code has been sent." });
      }

      // Generate temp PIN
      const tempPin = Math.floor(1000 + Math.random() * 9000).toString();

      // Hash and update
      const bcrypt = await import("bcryptjs");
      const pinHash = await bcrypt.hash(tempPin, 10);
      await storage.updatePin(user.id, pinHash);

      // Simulate Email sending
      console.log("==========================================");
      console.log(`[EMAIL SIMULATION] Password Reset for ${email}`);
      console.log(`Your temporary PIN is: ${tempPin}`);
      console.log("==========================================");

      res.json({
        message: "If an account exists with this email, a reset code has been sent.",
        tempPin: process.env.NODE_ENV !== 'production' ? tempPin : undefined
      });

    } catch (error) {
      console.error("Forgot PIN error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const { email, pin } = req.body;
      const user = await storage.getUserByEmail(email);

      if (!user) {
        return res.status(401).json({ message: "Invalid email or PIN" });
      }

      const isValid = await storage.validatePin(user.id, pin);
      if (isValid) {
        req.session.userId = user.id;
        res.json(user);
      } else {
        res.status(401).json({ message: "Invalid email or PIN" });
      }
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  // Settings Routes
  // Settings Routes
  app.post(api.auth.settings.updateBusinessName.path, requireAuth, async (req, res) => {
    console.log("Processing update business name request");
    try {
      const { businessName } = req.body;
      const validation = api.auth.settings.updateBusinessName.input.safeParse({ businessName });

      if (!validation.success) {
        return res.status(400).json({ message: "UPDATE_BIZ_NAME_VALIDATION_ERROR" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).send();

      // Check cooldown (30 mins = 30 * 60 * 1000 ms)
      if (user.lastBusinessNameChange) {
        const timeSinceLastChange = Date.now() - new Date(user.lastBusinessNameChange).getTime();
        const cooldown = 30 * 60 * 1000;
        if (timeSinceLastChange < cooldown) {
          const remainingMinutes = Math.ceil((cooldown - timeSinceLastChange) / 60000);
          return res.status(400).json({ message: `Please wait ${remainingMinutes} minutes before changing business name again.` });
        }
      }

      const updatedUser = await storage.updateBusinessName(user.id, businessName);
      res.json(updatedUser);
    } catch (e) {
      console.error("Error updating business name:", e);
      res.status(500).json({ message: "Failed to update business name" });
    }
  });

  app.post(api.auth.settings.updatePin.path, requireAuth, async (req, res) => {
    console.log("Processing update PIN request");
    try {
      const { currentPin, newPin } = req.body;
      const validation = api.auth.settings.updatePin.input.safeParse({ currentPin, newPin });

      if (!validation.success) {
        return res.status(400).json({ message: "UPDATE_PIN_VALIDATION_ERROR" });
      }

      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(401).send();

      // Validate current PIN
      const isValid = await storage.validatePin(user.id, currentPin);
      if (!isValid) {
        return res.status(400).json({ message: "UPDATE_PIN_INCORRECT_CURRENT" });
      }

      // Hash new PIN
      const bcrypt = await import("bcryptjs");
      const newPinHash = await bcrypt.hash(newPin, 10);

      await storage.updatePin(user.id, newPinHash);
      res.json({ message: "PIN updated successfully" });
    } catch (e) {
      console.error("Error updating PIN:", e);
      res.status(500).json({ message: "Failed to update PIN" });
    }
  });

  app.get(api.auth.me.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const user = await storage.getUser(req.session.userId);
    res.json(user);
  });

  // Transaction Routes
  app.get(api.transactions.list.path, requireAuth, async (req, res) => {
    const filters = {
      search: req.query.search as string,
      type: req.query.type as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };
    const txs = await storage.getTransactions(req.session.userId!, filters);
    res.json(txs);
  });

  app.post(api.transactions.create.path, requireAuth, async (req, res) => {
    try {
      console.log(`[DEBUG_TX_POST] Entering handler for /api/transactions`);
      console.log(`[Transaction] Creating transaction for user: ${req.session.userId}`);

      // 1. Validate Input
      const parseResult = api.transactions.create.input.safeParse(req.body);

      if (!parseResult.success) {
        const validationErrors = parseResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        console.error(`[Transaction] Validation failed:`, JSON.stringify(validationErrors, null, 2));
        return res.status(400).json({
          message: "TRANSACTION_ROUTE_VALIDATION_ERROR",
          errors: validationErrors,
          receivedBody: req.body
        });
      }

      // 2. Create Transaction
      const tx = await storage.createTransaction(parseResult.data, req.session.userId!);
      console.log(`[Transaction] Created successfully with ID: ${tx.id}`);
      res.status(201).json(tx);
    } catch (e: any) {
      console.error(`[Transaction] CRITICAL FAILURE:`, e);
      res.status(400).json({
        message: e.message || "Failed to create transaction",
        errorName: e.name,
        stack: e.stack,
        receivedBody: req.body,
        hint: "Check if all required fields are present in the JSON and types match."
      });
    }
  });

  app.delete(api.transactions.delete.path, requireAuth, async (req, res) => {
    await storage.deleteTransaction(Number(req.params.id));
    res.status(204).send();
  });

  // Customer Routes
  app.get(api.customers.list.path, requireAuth, async (req, res) => {
    const customers = await storage.getCustomers(req.session.userId!);
    res.json(customers);
  });

  app.get(api.customers.getByPhoneAndNetwork.path, requireAuth, async (req, res) => {
    const { phone_number, network } = req.query;
    console.log(`[Lookup] phone: ${phone_number}, network: ${network}`);
    if (!phone_number || !network) {
      return res.status(400).json({ message: "Phone number and network are required" });
    }
    const customer = await storage.getCustomerByPhoneAndNetwork(String(phone_number), String(network), req.session.userId!);
    res.json(customer || null);
  });

  app.get(api.customers.get.path, requireAuth, async (req, res) => {
    const idParam = req.params.id;
    const id = parseInt(idParam);

    if (isNaN(id)) {
      console.warn(`[Routes] Rejecting NaN customer ID: ${idParam}`);
      return res.status(400).json({ message: "Invalid customer ID format" });
    }

    const customer = await storage.getCustomer(id);

    // Ensure customer belongs to user
    if (!customer || customer.userId !== req.session.userId) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json(customer);
  });

  // Dashboard
  app.get(api.dashboard.stats.path, requireAuth, async (req, res) => {
    const stats = await storage.getDashboardStats(req.session.userId!);
    res.json(stats);
  });

  app.get(api.dashboard.storage.path, requireAuth, async (req, res) => {
    // Mock storage stats or real from User
    const user = await storage.getUser(req.session.userId!);
    res.json({
      used: user?.storageUsed || 0,
      limit: user?.storageLimit || 15 * 1024 * 1024 * 1024,
      percentage: ((user?.storageUsed || 0) / (user?.storageLimit || 1)) * 100
    });
  });

  // Backup Routes
  app.post(api.backup.create.path, requireAuth, async (req, res) => {
    const result = await backupService.createBackup(req.session.userId!);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ message: result.message });
    }
  });

  app.get(api.backup.list.path, requireAuth, async (req, res) => {
    const backups = await backupService.listBackups(req.session.userId!);
    res.json(backups);
  });

  app.post(api.backup.restore.path, requireAuth, async (req, res) => {
    const { backupId } = req.body;
    const success = await backupService.restoreBackup(req.session.userId!, backupId);
    if (success) {
      res.json({ message: "Restore initiated (Not fully implemented in web version)" });
    } else {
      res.status(400).json({ message: "Restore failed" });
    }
  });

  // Seed Data
  if (process.env.NODE_ENV !== 'production') {
    const defaultUser = await storage.getUserByBusinessName("MoMo Vendor");
    if (!defaultUser) {
      console.log("Seeding database...");
      try {
        const user = await storage.createUser({
          businessName: "MoMo Vendor",
          pinHash: "1234"
        });

        const customer = await storage.createCustomer({
          name: "Kwame Mensah",
          phoneNumber: "0244123456",
          network: "MTN MoMo"
        }, user.id);

        await storage.createTransaction({
          type: "Cash In",
          amount: "500",
          fee: "5",
          date: new Date().toISOString().split('T')[0],
          time: "10:30",
          notes: "Initial deposit",
          customerName: customer.name,
          phoneNumber: customer.phoneNumber,
          network: "MTN MoMo"
        }, user.id);
        console.log("Database seeded!");
      } catch (e) {
        console.error("Seeding failed:", e);
      }
    }
  }

  return httpServer;
}
