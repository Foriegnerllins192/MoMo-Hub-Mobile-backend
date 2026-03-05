import { z } from 'zod';
import { insertUserSchema, insertTransactionSchema, insertCustomerSchema, users, customers, transactions } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login',
      input: z.object({
        email: z.string().email(),
        pin: z.string()
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout',
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    settings: {
      updateBusinessName: {
        method: 'POST' as const,
        path: '/api/settings/business-name',
        input: z.object({ businessName: z.string().min(3) }),
        responses: {
          200: z.custom<typeof users.$inferSelect>(),
          400: errorSchemas.validation,
        },
      },
      updatePin: {
        method: 'POST' as const,
        path: '/api/settings/pin',
        input: z.object({
          currentPin: z.string(),
          newPin: z.string().min(4)
        }),
        responses: {
          200: z.object({ message: z.string() }),
          400: errorSchemas.validation,
        },
      }
    },
    setup: { // Initial setup
      method: 'POST' as const,
      path: '/api/auth/setup',
      input: z.object({
        businessName: z.string(),
        email: z.string().email(),
        pin: z.string().min(4)
      }),
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    forgotPin: {
      method: 'POST' as const,
      path: '/api/auth/forgot-pin',
      input: z.object({ email: z.string().email() }),
      responses: {
        200: z.object({ message: z.string(), tempPin: z.string().optional() }), // tempPin optional for dev mode
        400: errorSchemas.validation,
      },
    }
  },
  transactions: {
    list: {
      method: 'GET' as const,
      path: '/api/transactions',
      input: z.object({
        search: z.string().optional(),
        type: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof transactions.$inferSelect & { customer: typeof customers.$inferSelect | null }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/transactions',
      input: insertTransactionSchema.extend({
        customerName: z.string(), // To auto-create/link customer
        phoneNumber: z.string(),
        network: z.enum(["MTN MoMo", "Telecel Cash", "AirtelTigo Money"]),
      }),
      responses: {
        201: z.custom<typeof transactions.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/transactions/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    }
  },
  customers: {
    list: {
      method: 'GET' as const,
      path: '/api/customers',
      input: z.object({ search: z.string().optional() }).optional(),
      responses: {
        200: z.array(z.custom<typeof customers.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/customers/:id',
      responses: {
        200: z.custom<typeof customers.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    getByPhoneAndNetwork: {
      method: 'GET' as const,
      path: '/api/customers/lookup', // Query params: phone_number, network
      responses: {
        200: z.custom<typeof customers.$inferSelect | null>(),
      },
    }
  },
  dashboard: {
    stats: {
      method: 'GET' as const,
      path: '/api/dashboard/stats',
      responses: {
        200: z.object({
          todayCount: z.number(),
          totalCashIn: z.number(),
          totalCashOut: z.number(),
          totalFees: z.number(),
          netProfit: z.number(),
        }),
      },
    },
    storage: {
      method: 'GET' as const,
      path: '/api/dashboard/storage',
      responses: {
        200: z.object({
          used: z.number(),
          limit: z.number(),
          percentage: z.number(),
        }),
      },
    }
  },
  backup: {
    create: {
      method: 'POST' as const,
      path: '/api/backup',
      responses: {
        200: z.object({ message: z.string(), size: z.number() }),
        400: errorSchemas.internal,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/backup',
      responses: {
        200: z.array(z.object({
          id: z.string(),
          name: z.string(),
          size: z.number(),
          created_at: z.string(),
        })),
      },
    },
    restore: {
      method: 'POST' as const,
      path: '/api/backup/restore',
      input: z.object({ backupId: z.string() }),
      responses: {
        200: z.object({ message: z.string() }),
        400: errorSchemas.internal,
      },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
