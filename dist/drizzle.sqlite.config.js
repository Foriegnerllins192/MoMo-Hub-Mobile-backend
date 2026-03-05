"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const drizzle_kit_1 = require("drizzle-kit");
exports.default = (0, drizzle_kit_1.defineConfig)({
    out: "./migrations",
    schema: "../shared/schema.ts",
    dialect: "sqlite",
    dbCredentials: {
        url: "database.db",
    },
});
//# sourceMappingURL=drizzle.sqlite.config.js.map