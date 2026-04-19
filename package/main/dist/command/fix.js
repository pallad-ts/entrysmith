"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFix = runFix;
const get_packages_1 = require("@manypkg/get-packages");
const common_errors_1 = require("@pallad/common-errors");
const node_path_1 = require("node:path");
const config_1 = require("../config");
const entrypoints_1 = require("../entrypoints");
const dependency_1 = require("../model/dependency");
const package_json_1 = require("../package-json");
const tsconfig_1 = require("../tsconfig");
async function runFix(projectDirectory) {
    const config = getRightValueOrThrow(await (0, config_1.loadConfig)(projectDirectory));
    const entrypoints = (0, entrypoints_1.resolveEntrypoints)(config.entrypoints);
    const packageJson = await (0, package_json_1.loadPackageJson)(projectDirectory);
    const packageJsonResult = await (0, package_json_1.applyEntrypointsToPackageJson)(packageJson, {
        entrypoints,
        entrypointOutputMode: config.entrypointOutputMode,
        packageOutputDirectory: config.packageOutputDirectory,
    });
    const workspaceDependencies = await resolveWorkspaceDependencies(projectDirectory, packageJson);
    const tsConfigReferenceUpdates = await (0, tsconfig_1.updateTsConfigReferences)({
        projectDirectory,
        tsConfigPaths: config.typescript.referenceTsConfigPaths,
        dependencies: workspaceDependencies,
        tsConfigTargetPath: config.typescript.tsConfigTargetPath,
    });
    const tsConfigPathUpdates = await (0, tsconfig_1.updateTsConfigPathMappings)({
        projectDirectory,
        tsConfigPaths: config.typescript.referenceTsConfigPaths,
        dependencies: workspaceDependencies,
    });
    return {
        packageJsonUpdated: packageJsonResult.updated,
        tsConfigReferenceUpdates,
        tsConfigPathUpdates,
        workspaceDependencyCount: workspaceDependencies.length,
    };
}
async function resolveWorkspaceDependencies(projectDirectory, packageJson) {
    let packageCollection;
    try {
        packageCollection = await (0, get_packages_1.getPackages)(projectDirectory);
    }
    catch {
        return [];
    }
    const workspacePackagesByName = new Map();
    for (const workspacePackage of packageCollection.packages) {
        if (typeof workspacePackage.packageJson.name !== "string") {
            continue;
        }
        workspacePackagesByName.set(workspacePackage.packageJson.name, {
            absolutePath: node_path_1.default.resolve(workspacePackage.dir),
        });
    }
    const dependencies = (0, package_json_1.getPackageDependencies)(packageJson);
    const resolvedDependencies = [];
    for (const dependencyName of dependencies) {
        const workspaceDependency = workspacePackagesByName.get(dependencyName);
        if (!workspaceDependency) {
            continue;
        }
        const dependencyConfigResult = await (0, config_1.loadConfig)(workspaceDependency.absolutePath);
        if (dependencyConfigResult.isLeft()) {
            const dependencyError = getLeftValueOrThrow(dependencyConfigResult);
            if (dependencyError instanceof common_errors_1.NotFoundError) {
                continue;
            }
            throw dependencyError;
        }
        const dependencyConfig = getRightValueOrThrow(dependencyConfigResult);
        const dependencyEntrypoints = (0, entrypoints_1.resolveEntrypoints)(dependencyConfig.entrypoints);
        resolvedDependencies.push(dependency_1.Dependency.create({
            name: dependencyName,
            absolutePath: workspaceDependency.absolutePath,
            entrypointList: dependencyEntrypoints,
        }));
    }
    return resolvedDependencies;
}
function getLeftValueOrThrow(value) {
    return value.fold(error => error, () => {
        throw new Error("Unexpected right Either state.");
    });
}
function getRightValueOrThrow(value) {
    return value.fold(error => {
        throw error;
    }, result => result);
}
