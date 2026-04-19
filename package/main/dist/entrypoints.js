"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEntrypoints = resolveEntrypoints;
const node_path_1 = require("node:path");
const resolved_entrypoint_1 = require("./model/resolved-entrypoint");
const INDEX_SEGMENT = "/index";
function resolveEntrypoints(entrypoints) {
    const seenNames = new Set();
    const seenPaths = new Set();
    return entrypoints.map(entrypoint => {
        const sourcePath = normalizeEntrypointSourcePath(entrypoint);
        const entryPointPath = removeExtension(sourcePath);
        const entryPointName = createEntrypointName(entryPointPath);
        if (entryPointName.length === 0) {
            throw new Error(`Entrypoint "${entrypoint}" resolves to package root. Root exports are not supported in entrysmith.entrypoints.`);
        }
        if (seenNames.has(entryPointName)) {
            throw new Error(`Duplicate entrypoint name detected: "${entryPointName}".`);
        }
        if (seenPaths.has(entryPointPath)) {
            throw new Error(`Duplicate entrypoint path detected: "${entryPointPath}".`);
        }
        seenNames.add(entryPointName);
        seenPaths.add(entryPointPath);
        return resolved_entrypoint_1.ResolvedEntrypoint.create({
            sourcePath,
            entryPointPath,
            entryPointName,
        });
    });
}
function normalizeEntrypointSourcePath(entrypoint) {
    const normalized = node_path_1.default.posix.normalize(entrypoint.replace(/\\/g, "/").replace(/^\.\//, ""));
    if (normalized.length === 0 || normalized === ".") {
        throw new Error("Entrypoint path cannot be empty.");
    }
    if (node_path_1.default.posix.isAbsolute(normalized)) {
        throw new Error(`Entrypoint path must be relative to src directory, received absolute path: "${entrypoint}".`);
    }
    if (normalized.startsWith("../") || normalized === "..") {
        throw new Error(`Entrypoint path cannot leave src directory: "${entrypoint}".`);
    }
    const withoutSourcePrefix = normalized.startsWith("src/") ? normalized.slice(4) : normalized;
    if (withoutSourcePrefix.length === 0) {
        throw new Error(`Entrypoint path "${entrypoint}" does not point to a file inside src directory.`);
    }
    if (withoutSourcePrefix.startsWith("../") || withoutSourcePrefix === "..") {
        throw new Error(`Entrypoint path cannot leave src directory: "${entrypoint}".`);
    }
    return withoutSourcePrefix;
}
function removeExtension(value) {
    const extension = node_path_1.default.posix.extname(value);
    if (extension.length === 0) {
        return value;
    }
    return value.slice(0, -extension.length);
}
function createEntrypointName(entryPointPath) {
    if (entryPointPath === "index") {
        return "";
    }
    if (entryPointPath.endsWith(INDEX_SEGMENT)) {
        return entryPointPath.slice(0, -INDEX_SEGMENT.length);
    }
    return entryPointPath;
}
