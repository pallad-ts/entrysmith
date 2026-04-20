import { readFile, writeFile } from "node:fs/promises";
import { PackageJson, PackageJsonExports, readPackageJSON, writePackageJSON } from "pkg-types";
import { ParseError, parse, printParseErrorCode } from "jsonc-parser";

import * as path from "node:path";

import { Dependency } from "../model/Dependency";
import { Entrypoint } from "../model/Entrypoint";
import { Project } from "../model/Project";
import { normalizePath } from "../util/normalizePath";
import { createExportForEntrypoint } from "./internal/createExportForEntrypoint";
import { loadProjectAndDependency } from "./internal/loadProjectAndDependency";

type PackageJsonExportsMap = Record<string, PackageJsonExports | undefined>;

export async function apply(packagePath: string): Promise<void> {
	const absolutePackagePath = path.resolve(packagePath);
	const { dependency, project } = await loadProjectAndDependency(absolutePackagePath);

	await applyPackageJsonChanges(dependency, project);
	await applyTsConfigChanges(dependency, project);
}

async function applyPackageJsonChanges(dependency: Dependency, project: Project): Promise<void> {
	const packageDirectory = path.resolve(project.path, dependency.path);
	const packageJsonPath = path.resolve(packageDirectory, "package.json");

	const packageJson = await readPackageJSON(packageDirectory);

	const files = packageJson.files ?? [];
	if (!files.includes(dependency.config.packageOutputDirectory)) {
		files.push(dependency.config.packageOutputDirectory);
	}

	const exportsField: PackageJsonExportsMap = {};
	for (const entrypoint of [...dependency.entrypointList].sort(compareEntrypointsByName)) {
		const [key, value] = createExportForEntrypoint(
			entrypoint,
			dependency.config.packageOutputDirectory,
			dependency.config.entrypointOutputMode
		);
		exportsField[key] = value;
	}

	exportsField["./package.json"] = "./package.json";

	const nextPackageJson: PackageJson = {
		...packageJson,
		files,
		exports: exportsField as PackageJsonExports,
	};

	await writePackageJSON(packageJsonPath, nextPackageJson);
}

async function applyTsConfigChanges(dependency: Dependency, project: Project): Promise<void> {
	const packageDirectory = path.resolve(project.path, dependency.path);
	const workspaceDependencyList = await loadWorkspaceDependenciesForPackage(dependency, project);
	const referenceTsConfigPathList = uniquePathList(dependency.config.typescript.referenceTsConfigPaths);
	const pathMappingTsConfigPathSet = new Set(await resolvePathMappingTsConfigPathList(packageDirectory, referenceTsConfigPathList));
	const tsConfigPathSet = new Set([...referenceTsConfigPathList, ...pathMappingTsConfigPathSet]);

	for (const tsConfigPath of tsConfigPathSet) {
		const absoluteTsConfigPath = path.resolve(packageDirectory, tsConfigPath);
		const tsConfig = await readJsoncObject(absoluteTsConfigPath);

		if (referenceTsConfigPathList.includes(tsConfigPath)) {
			applyReferencesToTsConfig(tsConfig, workspaceDependencyList, absoluteTsConfigPath, project.path);
		}

		if (pathMappingTsConfigPathSet.has(tsConfigPath)) {
			applyPathsToTsConfig(tsConfig, workspaceDependencyList, absoluteTsConfigPath, project.path);
		}

		await writeFile(absoluteTsConfigPath, `${JSON.stringify(tsConfig, null, 2)}\n`, "utf8");
	}
}

function compareEntrypointsByName(left: Entrypoint, right: Entrypoint): number {
	return left.fullName.localeCompare(right.fullName);
}

async function loadWorkspaceDependenciesForPackage(dependency: Dependency, project: Project): Promise<Dependency[]> {
	const packageJson = await readPackageJSON(path.resolve(project.path, dependency.path));
	const dependencyNameSet = new Set<string>();

	for (const dependencyField of [
		packageJson.dependencies,
		packageJson.devDependencies,
		packageJson.peerDependencies,
		packageJson.optionalDependencies,
	]) {
		for (const dependencyName of Object.keys(dependencyField ?? {})) {
			dependencyNameSet.add(dependencyName);
		}
	}

	return project.dependencyList
		.filter(candidate => {
			return candidate.name !== dependency.name && dependencyNameSet.has(candidate.name);
		})
		.sort((left, right) => {
			return left.name.localeCompare(right.name);
		});
}

async function resolvePathMappingTsConfigPathList(packageDirectory: string, tsConfigPathList: string[]): Promise<string[]> {
	if (tsConfigPathList.length <= 1) {
		return tsConfigPathList;
	}

	const tsConfigPathSet = new Set(tsConfigPathList);
	const childTsConfigPathSet = new Set<string>();

	for (const tsConfigPath of tsConfigPathList) {
		const tsConfig = await readJsoncObject(path.resolve(packageDirectory, tsConfigPath));
		const extendedTsConfigPath = resolveExtendedTsConfigPath(tsConfigPath, tsConfig.extends);

		if (extendedTsConfigPath !== undefined && tsConfigPathSet.has(extendedTsConfigPath)) {
			childTsConfigPathSet.add(tsConfigPath);
		}
	}

	const parentTsConfigPathList = tsConfigPathList.filter(tsConfigPath => {
		return !childTsConfigPathSet.has(tsConfigPath);
	});

	return parentTsConfigPathList.length === 0 ? tsConfigPathList : parentTsConfigPathList;
}

function resolveExtendedTsConfigPath(tsConfigPath: string, extendsValue: unknown): string | undefined {
	if (typeof extendsValue !== "string" || (!extendsValue.startsWith(".") && !extendsValue.startsWith("/"))) {
		return undefined;
	}

	const normalizedPath = normalizePath(path.posix.join(path.posix.dirname(tsConfigPath), extendsValue)).replace(/^\//, "");
	if (path.posix.extname(normalizedPath).length > 0) {
		return normalizedPath;
	}

	return `${normalizedPath}.json`;
}

function applyReferencesToTsConfig(
	tsConfig: JsonObject,
	workspaceDependencyList: Dependency[],
	absTsConfigPath: string,
	projectPath: string
): void {
	const nextReferenceList = new Map<string, { path: string }>();

	for (const reference of readReferences(tsConfig.references)) {
		nextReferenceList.set(reference.path, reference);
	}

	for (const workspaceDependency of workspaceDependencyList) {
		const referenceTargetPath = workspaceDependency.config.typescript.tsConfigTargetPath ?? ".";
		const absoluteReferenceTargetPath = path.resolve(projectPath, workspaceDependency.path, referenceTargetPath);
		const relativeReferenceTargetPath = normalizePath(path.relative(path.dirname(absTsConfigPath), absoluteReferenceTargetPath));

		nextReferenceList.set(relativeReferenceTargetPath, {
			path: relativeReferenceTargetPath,
		});
	}

	if (nextReferenceList.size === 0 && tsConfig.references === undefined) {
		return;
	}

	tsConfig.references = [...nextReferenceList.values()].sort((left, right) => {
		return left.path.localeCompare(right.path);
	});
}

function applyPathsToTsConfig(
	tsConfig: JsonObject,
	workspaceDependencyList: Dependency[],
	absTsConfigPath: string,
	projectPath: string
): void {
	const existingCompilerOptions = isObject(tsConfig.compilerOptions) ? tsConfig.compilerOptions : undefined;
	const nextPathMap = {
		...readPathMap(existingCompilerOptions?.paths),
	};

	for (const workspaceDependency of workspaceDependencyList) {
		for (const entrypoint of [...workspaceDependency.entrypointList].sort(compareEntrypointsByName)) {
			const entrypointImportPath = createEntrypointImportPath(workspaceDependency, entrypoint);
			const absoluteSourcePath = path.resolve(projectPath, workspaceDependency.path, removeExtension(entrypoint.sourcePath("src")));
			const relativeSourcePath = normalizePath(path.relative(path.dirname(absTsConfigPath), absoluteSourcePath));

			nextPathMap[entrypointImportPath] = [relativeSourcePath];
		}
	}

	if (Object.keys(nextPathMap).length === 0 && existingCompilerOptions?.paths === undefined) {
		return;
	}

	const compilerOptions = ensureObjectProperty(tsConfig, "compilerOptions");

	compilerOptions.paths = Object.fromEntries(
		Object.entries(nextPathMap).sort(([leftKey], [rightKey]) => {
			return leftKey.localeCompare(rightKey);
		})
	);
}

function createEntrypointImportPath(dependency: Dependency, entrypoint: Entrypoint): string {
	if (entrypoint.name === "index") {
		return entrypoint.directory === undefined ? dependency.name : `${dependency.name}/${entrypoint.directory}`;
	}

	return `${dependency.name}/${entrypoint.fullName}`;
}

function readReferences(value: unknown): { path: string }[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter((reference): reference is { path: string } => {
		return isObject(reference) && typeof reference.path === "string";
	});
}

function readPathMap(value: unknown): Record<string, string[]> {
	if (!isObject(value)) {
		return {};
	}

	return Object.fromEntries(
		Object.entries(value).filter(([, pathList]) => {
			return Array.isArray(pathList) && pathList.every(pathSegment => typeof pathSegment === "string");
		})
	) as Record<string, string[]>;
}

async function readJsoncObject(filePath: string): Promise<JsonObject> {
	const content = await readFile(filePath, "utf8");
	const parseErrorList: ParseError[] = [];
	const parsed = parse(content, parseErrorList, {
		allowTrailingComma: true,
		disallowComments: false,
	});

	if (parseErrorList.length > 0) {
		throw new Error(`Failed to parse JSONC file at ${filePath}: ${printParseErrorCode(parseErrorList[0].error)}`);
	}

	if (!isObject(parsed)) {
		throw new Error(`Expected JSON object in ${filePath}`);
	}

	return parsed;
}

function uniquePathList(pathList: string[]): string[] {
	return [...new Set(pathList.map(pathSegment => normalizePath(pathSegment)))];
}

function ensureObjectProperty(value: JsonObject, key: string): JsonObject {
	const existingValue = value[key];
	if (isObject(existingValue)) {
		return existingValue;
	}

	const nextValue: JsonObject = {};
	value[key] = nextValue;
	return nextValue;
}

function isObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function removeExtension(value: string): string {
	const extension = path.posix.extname(value);
	if (extension.length === 0) {
		return value;
	}

	return value.slice(0, -extension.length);
}

type JsonObject = Record<string, unknown>;
