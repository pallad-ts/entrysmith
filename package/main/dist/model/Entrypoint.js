"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Entrypoint = void 0;
const node_path_1 = require("node:path");
const SOURCE_DIRECTORY_PREFIX = "src/";
const INDEX_SEGMENT = "/index";
class Entrypoint {
    name;
    path;
    constructor(name, path) {
        this.name = name;
        this.path = path;
        if (path.length === 0) {
            throw new Error("Entrypoint path cannot be empty.");
        }
        if (name !== undefined && name.length === 0) {
            throw new Error("Entrypoint name cannot be empty.");
        }
    }
    static fromString(input) {
        const trimmedInput = input.trim();
        if (trimmedInput.length === 0) {
            throw new Error("Entrypoint path cannot be empty.");
        }
        const normalizedSlashesInput = trimmedInput.replace(/\\/g, "/");
        const hasUpperDirectoryAttempt = normalizedSlashesInput
            .split("/")
            .some(segment => segment === "..");
        if (hasUpperDirectoryAttempt) {
            throw new Error(`Entrypoint path cannot contain upper-directory segments: "${input}".`);
        }
        const normalizedPath = node_path_1.default.posix
            .normalize(normalizedSlashesInput.replace(/^\.\//, ""));
        if (node_path_1.default.posix.isAbsolute(normalizedPath)) {
            throw new Error(`Entrypoint path must be relative: "${input}".`);
        }
        const pathRelativeToSource = normalizedPath.startsWith(SOURCE_DIRECTORY_PREFIX)
            ? normalizedPath.slice(SOURCE_DIRECTORY_PREFIX.length)
            : normalizedPath;
        if (pathRelativeToSource.length === 0 || pathRelativeToSource === ".") {
            throw new Error(`Entrypoint path "${input}" does not point to a file inside src directory.`);
        }
        const pathWithSourcePrefix = `${SOURCE_DIRECTORY_PREFIX}${pathRelativeToSource}`;
        const pathWithoutExtension = removeExtension(pathRelativeToSource);
        if (pathWithoutExtension === "index") {
            return new Entrypoint(undefined, pathWithSourcePrefix);
        }
        if (pathWithoutExtension.endsWith(INDEX_SEGMENT)) {
            return new Entrypoint(pathWithoutExtension.slice(0, -INDEX_SEGMENT.length), pathWithSourcePrefix);
        }
        return new Entrypoint(pathWithoutExtension, pathWithSourcePrefix);
    }
}
exports.Entrypoint = Entrypoint;
function removeExtension(value) {
    const extension = node_path_1.default.posix.extname(value);
    if (extension.length === 0) {
        return value;
    }
    return value.slice(0, -extension.length);
}
