import PackageJson from "@npmcli/package-json";
import path from "node:path";

import type { ResolvedEntrypoint } from "./model/resolved-entrypoint";

type EntrypointOutputMode = "commonjs" | "module";

export type PackageJsonFile = {
	content: PackageJsonContent;
	update(values: Record<string, unknown>): void;
	save(): Promise<void>;
};

type PackageJsonContent = {
	files?: unknown;
	exports?: unknown;
	dependencies?: Record<string, string>;
	[name: string]: unknown;
};

type PackageJsonUpdateResult = {
	updated: boolean;
};

export async function loadPackageJson(projectDirectory: string): Promise<PackageJsonFile> {
	return PackageJson.load(projectDirectory);
}

export function getPackageDependencies(packageJson: PackageJsonFile): string[] {
	const content = packageJson.content as PackageJsonContent;
	return Object.keys(content.dependencies ?? {}).sort();
}

export async function applyEntrypointsToPackageJson(
	packageJson: PackageJsonFile,
	options: {
		entrypoints: ResolvedEntrypoint[];
		entrypointOutputMode: EntrypointOutputMode;
		packageOutputDirectory: string;
	}
): Promise<PackageJsonUpdateResult> {
	const content = packageJson.content as PackageJsonContent;
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

function ensureOutputDirectoryInFiles(filesField: unknown, packageOutputDirectory: string): string[] {
	const files = Array.isArray(filesField) ? filesField.filter((value): value is string => typeof value === "string") : [];
	const hasOutputDirectory = files.some(file => normalizePathLikeValue(file) === packageOutputDirectory);

	if (hasOutputDirectory) {
		return files;
	}

	return [...files, packageOutputDirectory];
}

function ensureEntrypointExports(options: {
	exportsField: unknown;
	entrypoints: ResolvedEntrypoint[];
	entrypointOutputMode: EntrypointOutputMode;
	packageOutputDirectory: string;
}): Record<string, unknown> {
	const exportsObject = normalizeExportsField(options.exportsField);

	for (const entrypoint of options.entrypoints) {
		const exportPath = toPosixPath(path.posix.join(options.packageOutputDirectory, `${entrypoint.entryPointPath}.js`));
		const exportKey = `./${entrypoint.entryPointName}`;

		exportsObject[exportKey] =
			options.entrypointOutputMode === "commonjs" ? { default: `./${exportPath}` } : { import: `./${exportPath}` };
	}

	exportsObject["./package.json"] = "./package.json";

	return exportsObject;
}

function normalizeOutputDirectory(directory: string): string {
	const normalized = normalizePathLikeValue(directory);

	if (normalized.length === 0 || normalized === ".") {
		throw new Error("entrysmith.packageOutputDirectory cannot be empty.");
	}

	return normalized;
}

function normalizePathLikeValue(value: string): string {
	const normalized = toPosixPath(path.posix.normalize(value.replace(/\\/g, "/")).replace(/\/$/, ""));

	if (normalized.startsWith("./")) {
		return normalized.slice(2);
	}

	return normalized;
}

function normalizeExportsField(exportsField: unknown): Record<string, unknown> {
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPosixPath(value: string): string {
	return value.replace(/\\/g, "/");
}

function isDeepEqual(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}
