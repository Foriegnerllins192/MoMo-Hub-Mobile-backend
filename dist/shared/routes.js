"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.errorSchemas = void 0;
exports.buildUrl = buildUrl;
const zod_1 = require("zod");
const schema_1 = require("./schema");
exports.errorSchemas = {
    validation: zod_1.z.object({
        message: zod_1.z.string(),
        field: zod_1.z.string().optional(),
    }),
    notFound: zod_1.z.object({
        message: zod_1.z.string(),
    }),
    internal: zod_1.z.object({
        message: zod_1.z.string(),
    }),
    unauthorized: zod_1.z.object({
        message: zod_1.z.string(),
    }),
};
exports.api = {
    auth: {
        login: {
            method: 'POST',
            path: '/api/auth/login',
            input: zod_1.z.object({
                email: zod_1.z.string().email(),
                pin: zod_1.z.string()
            }),
            responses: {
                200: zod_1.z.custom(),
                401: exports.errorSchemas.unauthorized,
            },
        },
        logout: {
            method: 'POST',
            path: '/api/auth/logout',
            responses: {
                200: zod_1.z.object({ message: zod_1.z.string() }),
            },
        },
        me: {
            method: 'GET',
            path: '/api/auth/me',
            responses: {
                200: zod_1.z.custom(),
                401: exports.errorSchemas.unauthorized,
            },
        },
        settings: {
            updateBusinessName: {
                method: 'POST',
                path: '/api/settings/business-name',
                input: zod_1.z.object({ businessName: zod_1.z.string().min(3) }),
                responses: {
                    200: zod_1.z.custom(),
                    400: exports.errorSchemas.validation,
                },
            },
            updatePin: {
                method: 'POST',
                path: '/api/settings/pin',
                input: zod_1.z.object({
                    currentPin: zod_1.z.string(),
                    newPin: zod_1.z.string().min(4)
                }),
                responses: {
                    200: zod_1.z.object({ message: zod_1.z.string() }),
                    400: exports.errorSchemas.validation,
                },
            }
        },
        setup: {
            method: 'POST',
            path: '/api/auth/setup',
            input: zod_1.z.object({
                businessName: zod_1.z.string(),
                email: zod_1.z.string().email(),
                pin: zod_1.z.string().min(4)
            }),
            responses: {
                201: zod_1.z.custom(),
                400: exports.errorSchemas.validation,
            },
        },
        forgotPin: {
            method: 'POST',
            path: '/api/auth/forgot-pin',
            input: zod_1.z.object({ email: zod_1.z.string().email() }),
            responses: {
                200: zod_1.z.object({ message: zod_1.z.string(), tempPin: zod_1.z.string().optional() }), // tempPin optional for dev mode
                400: exports.errorSchemas.validation,
            },
        }
    },
    transactions: {
        list: {
            method: 'GET',
            path: '/api/transactions',
            input: zod_1.z.object({
                search: zod_1.z.string().optional(),
                type: zod_1.z.string().optional(),
                startDate: zod_1.z.string().optional(),
                endDate: zod_1.z.string().optional(),
            }).optional(),
            responses: {
                200: zod_1.z.array(zod_1.z.custom()),
            },
        },
        create: {
            method: 'POST',
            path: '/api/transactions',
            input: schema_1.insertTransactionSchema.extend({
                customerName: zod_1.z.string(), // To auto-create/link customer
                phoneNumber: zod_1.z.string(),
                network: zod_1.z.enum(["MTN MoMo", "Telecel Cash", "AirtelTigo Money"]),
            }),
            responses: {
                201: zod_1.z.custom(),
                400: exports.errorSchemas.validation,
            },
        },
        delete: {
            method: 'DELETE',
            path: '/api/transactions/:id',
            responses: {
                204: zod_1.z.void(),
                404: exports.errorSchemas.notFound,
            },
        }
    },
    customers: {
        list: {
            method: 'GET',
            path: '/api/customers',
            input: zod_1.z.object({ search: zod_1.z.string().optional() }).optional(),
            responses: {
                200: zod_1.z.array(zod_1.z.custom()),
            },
        },
        get: {
            method: 'GET',
            path: '/api/customers/:id',
            responses: {
                200: zod_1.z.custom(),
                404: exports.errorSchemas.notFound,
            },
        },
        getByPhoneAndNetwork: {
            method: 'GET',
            path: '/api/customers/lookup', // Query params: phone_number, network
            responses: {
                200: zod_1.z.custom(),
            },
        }
    },
    dashboard: {
        stats: {
            method: 'GET',
            path: '/api/dashboard/stats',
            responses: {
                200: zod_1.z.object({
                    todayCount: zod_1.z.number(),
                    totalCashIn: zod_1.z.number(),
                    totalCashOut: zod_1.z.number(),
                    totalFees: zod_1.z.number(),
                    netProfit: zod_1.z.number(),
                }),
            },
        },
        storage: {
            method: 'GET',
            path: '/api/dashboard/storage',
            responses: {
                200: zod_1.z.object({
                    used: zod_1.z.number(),
                    limit: zod_1.z.number(),
                    percentage: zod_1.z.number(),
                }),
            },
        }
    },
    backup: {
        create: {
            method: 'POST',
            path: '/api/backup',
            responses: {
                200: zod_1.z.object({ message: zod_1.z.string(), size: zod_1.z.number() }),
                400: exports.errorSchemas.internal,
            },
        },
        list: {
            method: 'GET',
            path: '/api/backup',
            responses: {
                200: zod_1.z.array(zod_1.z.object({
                    id: zod_1.z.string(),
                    name: zod_1.z.string(),
                    size: zod_1.z.number(),
                    created_at: zod_1.z.string(),
                })),
            },
        },
        restore: {
            method: 'POST',
            path: '/api/backup/restore',
            input: zod_1.z.object({ backupId: zod_1.z.string() }),
            responses: {
                200: zod_1.z.object({ message: zod_1.z.string() }),
                400: exports.errorSchemas.internal,
            },
        }
    }
};
function buildUrl(path, params) {
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
//# sourceMappingURL=routes.js.map