"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePath = normalizePath;
const node_path_1 = require("node:path");
function normalizePath(value) {
    return node_path_1.default.posix.normalize(value.replace(/\\/g, "/"));
}
