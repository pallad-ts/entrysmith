"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTsConfigReferences = updateTsConfigReferences;
exports.updateTsConfigPathMappings = updateTsConfigPathMappings;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const maybe_1 = require("@sweet-monads/maybe");
const jsonc_parser_1 = require("jsonc-parser");
async function updateTsConfigReferences(options) {
    const targetTsConfigPaths = options.tsConfigPaths.map(configPath => node_path_1.default.resolve(options.projectDirectory, configPath));
    const sortedDependencies = [...options.dependencies].sort((left, right) => left.name.localeCompare(right.name));
    let updatedCount = 0;
    for (const tsConfigPath of targetTsConfigPaths) {
        const tsConfig = await readTsConfigFile(tsConfigPath);
        const existingReferences = Array.isArray(tsConfig.references) ? [...tsConfig.references] : [];
        const referencesByPath = new Map();
        for (const reference of existingReferences) {
            if (typeof reference?.path !== "string") {
                continue;
            }
            referencesByPath.set(normalizeRelativePath(reference.path), reference);
        }
        let changed = false;
        for (const dependency of sortedDependencies) {
            const dependencyTargetPath = options.tsConfigTargetPath
                ? node_path_1.default.resolve(dependency.absolutePath, options.tsConfigTargetPath)
                : dependency.absolutePath;
            const relativePath = normalizeRelativePath(node_path_1.default.relative(node_path_1.default.dirname(tsConfigPath), dependencyTargetPath));
            if (!referencesByPath.has(relativePath)) {
                referencesByPath.set(relativePath, { path: relativePath });
                changed = true;
            }
        }
        if (!changed) {
            continue;
        }
        tsConfig.references = [...referencesByPath.values()].sort((left, right) => left.path.localeCompare(right.path));
        await writeTsConfigFile(tsConfigPath, tsConfig);
        updatedCount += 1;
    }
    return updatedCount;
}
async function updateTsConfigPathMappings(options) {
    const allTsConfigPaths = options.tsConfigPaths.map(configPath => node_path_1.default.resolve(options.projectDirectory, configPath));
    const targetTsConfigPaths = await resolvePathMappingConfigTargets(allTsConfigPaths);
    const sortedDependencies = [...options.dependencies].sort((left, right) => left.name.localeCompare(right.name));
    let updatedCount = 0;
    for (const tsConfigPath of targetTsConfigPaths) {
        const tsConfig = await readTsConfigFile(tsConfigPath);
        const compilerOptions = isRecord(tsConfig.compilerOptions) ? { ...tsConfig.compilerOptions } : {};
        const paths = isRecord(compilerOptions.paths) ? { ...compilerOptions.paths } : {};
        let changed = false;
        for (const dependency of sortedDependencies) {
            for (const entrypoint of dependency.entrypointList) {
                const mappingKey = `${dependency.name}/${entrypoint.entryPointName}`;
                const sourcePath = normalizeRelativePath(node_path_1.default.relative(node_path_1.default.dirname(tsConfigPath), node_path_1.default.resolve(dependency.absolutePath, "src", entrypoint.entryPointPath)));
                const mappingValue = [sourcePath];
                if (!areStringArraysEqual(paths[mappingKey], mappingValue)) {
                    paths[mappingKey] = mappingValue;
                    changed = true;
                }
            }
        }
        if (!changed) {
            continue;
        }
        compilerOptions.paths = paths;
        tsConfig.compilerOptions = compilerOptions;
        await writeTsConfigFile(tsConfigPath, tsConfig);
        updatedCount += 1;
    }
    return updatedCount;
}
async function resolvePathMappingConfigTargets(tsConfigPaths) {
    if (tsConfigPaths.length <= 1) {
        return tsConfigPaths;
    }
    const tsConfigSet = new Set(tsConfigPaths.map(configPath => node_path_1.default.resolve(configPath)));
    const childConfigs = new Set();
    for (const tsConfigPath of tsConfigSet.values()) {
        const tsConfig = await readTsConfigFile(tsConfigPath);
        const parentPath = await resolveExtendedTsConfigPath(tsConfigPath, tsConfig.extends);
        if (parentPath.isNone()) {
            continue;
        }
        if (tsConfigSet.has(parentPath.unwrap())) {
            childConfigs.add(tsConfigPath);
        }
    }
    const selectedConfigs = [...tsConfigSet.values()].filter(configPath => !childConfigs.has(configPath));
    return selectedConfigs.length > 0 ? selectedConfigs : tsConfigPaths;
}
async function resolveExtendedTsConfigPath(tsConfigPath, extendsField) {
    if (typeof extendsField !== "string" || extendsField.length === 0) {
        return (0, maybe_1.none)();
    }
    if (!extendsField.startsWith(".") && !node_path_1.default.isAbsolute(extendsField)) {
        return (0, maybe_1.none)();
    }
    const rawBasePath = node_path_1.default.isAbsolute(extendsField)
        ? node_path_1.default.resolve(extendsField)
        : node_path_1.default.resolve(node_path_1.default.dirname(tsConfigPath), extendsField);
    const candidates = node_path_1.default.extname(rawBasePath)
        ? [rawBasePath]
        : [rawBasePath, `${rawBasePath}.json`, node_path_1.default.join(rawBasePath, "tsconfig.json")];
    for (const candidate of candidates) {
        if (await pathExists(candidate)) {
            return (0, maybe_1.just)(node_path_1.default.resolve(candidate));
        }
    }
    return (0, maybe_1.none)();
}
async function readTsConfigFile(tsConfigPath) {
    let sourceText;
    try {
        sourceText = await (0, promises_1.readFile)(tsConfigPath, "utf8");
    }
    catch (error) {
        throw new Error(`Unable to read tsconfig file at ${tsConfigPath}: ${toErrorMessage(error)}`);
    }
    const parseErrors = [];
    const parsed = (0, jsonc_parser_1.parse)(sourceText, parseErrors, {
        allowTrailingComma: true,
        disallowComments: false,
    });
    if (parseErrors.length > 0) {
        throw new Error(`Unable to parse tsconfig file at ${tsConfigPath}.`);
    }
    if (!isRecord(parsed)) {
        return {};
    }
    return parsed;
}
async function writeTsConfigFile(tsConfigPath, config) {
    const sourceText = `${JSON.stringify(config, null, 2)}\n`;
    await (0, promises_1.writeFile)(tsConfigPath, sourceText, "utf8");
}
async function pathExists(targetPath) {
    try {
        await (0, promises_1.access)(targetPath);
        return true;
    }
    catch {
        return false;
    }
}
function normalizeRelativePath(value) {
    const normalized = toPosixPath(node_path_1.default.posix.normalize(value.replace(/\\/g, "/")));
    if (normalized.startsWith("../") || normalized.startsWith("./")) {
        return normalized;
    }
    if (normalized === ".." || normalized === ".") {
        return normalized;
    }
    return `./${normalized}`;
}
function areStringArraysEqual(left, right) {
    if (!Array.isArray(left) || left.length !== right.length) {
        return false;
    }
    for (let index = 0; index < left.length; index += 1) {
        if (left[index] !== right[index]) {
            return false;
        }
    }
    return true;
}
function toPosixPath(value) {
    return value.replace(/\\/g, "/");
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function toErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
