"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const drizzle_kit_1 = require("drizzle-kit");
exports.default = (0, drizzle_kit_1.defineConfig)({
    out: "./migrations",
    schema: "../shared/schema.ts",
    dialect: "sqlite",
    dbCredentials: {
        url: "file:./database.db",
    },
});
//# sourceMappingURL=drizzle.config.js.map