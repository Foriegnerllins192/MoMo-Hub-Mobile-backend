"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vite_1 = require("vite");
const plugin_react_1 = __importDefault(require("@vitejs/plugin-react"));
const path_1 = __importDefault(require("path"));
// @ts-ignore - Type definitions may not be available
const vite_plugin_runtime_error_modal_1 = __importDefault(require("@replit/vite-plugin-runtime-error-modal"));
exports.default = (0, vite_1.defineConfig)({
    plugins: [
        (0, plugin_react_1.default)(),
        (0, vite_plugin_runtime_error_modal_1.default)(),
    ],
    resolve: {
        alias: {
            "@shared": path_1.default.resolve(__dirname, "shared"),
        },
    },
    root: path_1.default.resolve(__dirname),
    build: {
        outDir: path_1.default.resolve(__dirname, "dist/public"),
        emptyOutDir: true,
    },
    server: {
        fs: {
            strict: false,
            allow: [".."],
        },
    },
});
//# sourceMappingURL=vite.config.js.map