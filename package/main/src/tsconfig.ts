import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { just, none, type Maybe } from "@sweet-monads/maybe";
import { parse, type ParseError } from "jsonc-parser";

import type { Dependency } from "./model/dependency";

type TsConfigReference = {
	path: string;
	[key: string]: unknown;
};

type TsConfigFile = {
	extends?: string;
	references?: TsConfigReference[];
	compilerOptions?: {
		paths?: Record<string, string[]>;
		[key: string]: unknown;
	};
	[key: string]: unknown;
};

type UpdateTsConfigReferencesOptions = {
	projectDirectory: string;
	tsConfigPaths: string[];
	dependencies: Dependency[];
	tsConfigTargetPath?: string;
};

type UpdateTsConfigPathMappingsOptions = {
	projectDirectory: string;
	tsConfigPaths: string[];
	dependencies: Dependency[];
};

export async function updateTsConfigReferences(options: UpdateTsConfigReferencesOptions): Promise<number> {
	const targetTsConfigPaths = options.tsConfigPaths.map(configPath => path.resolve(options.projectDirectory, configPath));
	const sortedDependencies = [...options.dependencies].sort((left, right) => left.name.localeCompare(right.name));

	let updatedCount = 0;

	for (const tsConfigPath of targetTsConfigPaths) {
		const tsConfig = await readTsConfigFile(tsConfigPath);
		const existingReferences = Array.isArray(tsConfig.references) ? [...tsConfig.references] : [];
		const referencesByPath = new Map<string, TsConfigReference>();

		for (const reference of existingReferences) {
			if (typeof reference?.path !== "string") {
				continue;
			}

			referencesByPath.set(normalizeRelativePath(reference.path), reference);
		}

		let changed = false;

		for (const dependency of sortedDependencies) {
			const dependencyTargetPath = options.tsConfigTargetPath
				? path.resolve(dependency.absolutePath, options.tsConfigTargetPath)
				: dependency.absolutePath;
			const relativePath = normalizeRelativePath(path.relative(path.dirname(tsConfigPath), dependencyTargetPath));

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

export async function updateTsConfigPathMappings(options: UpdateTsConfigPathMappingsOptions): Promise<number> {
	const allTsConfigPaths = options.tsConfigPaths.map(configPath => path.resolve(options.projectDirectory, configPath));
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
				const sourcePath = normalizeRelativePath(
					path.relative(path.dirname(tsConfigPath), path.resolve(dependency.absolutePath, "src", entrypoint.entryPointPath))
				);
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

async function resolvePathMappingConfigTargets(tsConfigPaths: string[]): Promise<string[]> {
	if (tsConfigPaths.length <= 1) {
		return tsConfigPaths;
	}

	const tsConfigSet = new Set(tsConfigPaths.map(configPath => path.resolve(configPath)));
	const childConfigs = new Set<string>();

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

async function resolveExtendedTsConfigPath(tsConfigPath: string, extendsField: unknown): Promise<Maybe<string>> {
	if (typeof extendsField !== "string" || extendsField.length === 0) {
		return none();
	}

	if (!extendsField.startsWith(".") && !path.isAbsolute(extendsField)) {
		return none();
	}

	const rawBasePath = path.isAbsolute(extendsField)
		? path.resolve(extendsField)
		: path.resolve(path.dirname(tsConfigPath), extendsField);

	const candidates = path.extname(rawBasePath)
		? [rawBasePath]
		: [rawBasePath, `${rawBasePath}.json`, path.join(rawBasePath, "tsconfig.json")];

	for (const candidate of candidates) {
		if (await pathExists(candidate)) {
			return just(path.resolve(candidate));
		}
	}

	return none();
}

async function readTsConfigFile(tsConfigPath: string): Promise<TsConfigFile> {
	let sourceText: string;

	try {
		sourceText = await readFile(tsConfigPath, "utf8");
	} catch (error) {
		throw new Error(`Unable to read tsconfig file at ${tsConfigPath}: ${toErrorMessage(error)}`);
	}

	const parseErrors: ParseError[] = [];
	const parsed = parse(sourceText, parseErrors, {
		allowTrailingComma: true,
		disallowComments: false,
	});

	if (parseErrors.length > 0) {
		throw new Error(`Unable to parse tsconfig file at ${tsConfigPath}.`);
	}

	if (!isRecord(parsed)) {
		return {};
	}

	return parsed as TsConfigFile;
}

async function writeTsConfigFile(tsConfigPath: string, config: TsConfigFile): Promise<void> {
	const sourceText = `${JSON.stringify(config, null, 2)}\n`;
	await writeFile(tsConfigPath, sourceText, "utf8");
}

async function pathExists(targetPath: string): Promise<boolean> {
	try {
		await access(targetPath);
		return true;
	} catch {
		return false;
	}
}

function normalizeRelativePath(value: string): string {
	const normalized = toPosixPath(path.posix.normalize(value.replace(/\\/g, "/")));

	if (normalized.startsWith("../") || normalized.startsWith("./")) {
		return normalized;
	}

	if (normalized === ".." || normalized === ".") {
		return normalized;
	}

	return `./${normalized}`;
}

function areStringArraysEqual(left: unknown, right: string[]): boolean {
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

function toPosixPath(value: string): string {
	return value.replace(/\\/g, "/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
