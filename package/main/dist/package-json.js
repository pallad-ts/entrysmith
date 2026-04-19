"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPackageJson = loadPackageJson;
exports.getPackageDependencies = getPackageDependencies;
exports.applyEntrypointsToPackageJson = applyEntrypointsToPackageJson;
const maybe_1 = require("@sweet-monads/maybe");
const node_path_1 = require("node:path");
async function loadPackageJson(projectDirectory) {
    const packageJsonModule = await getPackageJsonModule();
    return packageJsonModule.load(projectDirectory);
}
function getPackageDependencies(packageJson) {
    const content = packageJson.content;
    return Object.keys(content.dependencies ?? {}).sort();
}
async function applyEntrypointsToPackageJson(packageJson, options) {
    const content = packageJson.content;
    const normalizedOutputDirectory = normalizeOutputDirectory(options.packageOutputDirectory);
    const nextFiles = ensureOutputDirectoryInFiles(content.files, normalizedOutputDirectory);
    const nextExports = ensureEntrypointExports({
        exportsField: content.exports,
        entrypoints: options.entrypoints,
        entrypointOutputMode: options.entrypointOutputMode,
        packageOutputDirectory: normalizedOutputDirectory,
    });
    const filesChanged = !isDeepEqual(content.files, nextFiles);
    const exportsChanged = !isDeepEqual(content.exports, nextExports);
    if (!filesChanged && !exportsChanged) {
        return { updated: false };
    }
    packageJson.update({
        files: nextFiles,
        exports: nextExports,
    });
    await packageJson.save();
    return { updated: true };
}
function ensureOutputDirectoryInFiles(filesField, packageOutputDirectory) {
    const files = Array.isArray(filesField) ? filesField.filter((value) => typeof value === "string") : [];
    const hasOutputDirectory = files.some(file => normalizePathLikeValue(file) === packageOutputDirectory);
    if (hasOutputDirectory) {
        return files;
    }
    return [...files, packageOutputDirectory];
}
function ensureEntrypointExports(options) {
    const exportsObject = normalizeExportsField(options.exportsField);
    for (const entrypoint of options.entrypoints) {
        const exportPath = toPosixPath(node_path_1.default.posix.join(options.packageOutputDirectory, `${entrypoint.entryPointPath}.js`));
        const exportKey = `./${entrypoint.entryPointName}`;
        exportsObject[exportKey] =
            options.entrypointOutputMode === "commonjs" ? { default: `./${exportPath}` } : { import: `./${exportPath}` };
    }
    exportsObject["./package.json"] = "./package.json";
    return exportsObject;
}
function normalizeOutputDirectory(directory) {
    const normalized = normalizePathLikeValue(directory);
    if (normalized.length === 0 || normalized === ".") {
        throw new Error("entrysmith.packageOutputDirectory cannot be empty.");
    }
    return normalized;
}
function normalizePathLikeValue(value) {
    const normalized = toPosixPath(node_path_1.default.posix.normalize(value.replace(/\\/g, "/")).replace(/\/$/, ""));
    if (normalized.startsWith("./")) {
        return normalized.slice(2);
    }
    return normalized;
}
function normalizeExportsField(exportsField) {
    if (isRecord(exportsField)) {
        return { ...exportsField };
    }
    if (typeof exportsField === "string" || Array.isArray(exportsField)) {
        return {
            ".": exportsField,
        };
    }
    return {};
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function toPosixPath(value) {
    return value.replace(/\\/g, "/");
}
function isDeepEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
let packageJsonModulePromise = (0, maybe_1.none)();
async function getPackageJsonModule() {
    if (packageJsonModulePromise.isNone()) {
        const loadPromise = Promise.resolve().then(() => require("@npmcli/package-json")).then(module => {
            const loadedModule = module.default ?? module;
            if (typeof loadedModule.load !== "function") {
                throw new Error("Failed to load @npmcli/package-json module.");
            }
            return loadedModule;
        });
        packageJsonModulePromise = (0, maybe_1.just)(loadPromise);
    }
    return packageJsonModulePromise.unwrap();
}
