import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach } from "vitest";

import { PackageJson, TSConfig } from "pkg-types";

import { PackageJsonFile } from "../../model/PackageJsonFile";
import { TsConfigFile } from "../../model/TsConfigFile";
import { apply } from "../apply";

const tempDirectoryList: string[] = [];
let fixturePath: string;

describe("apply", () => {
	beforeEach(async () => {
		fixturePath = await createFixtureCopy();
	});

	afterEach(async () => {
		await Promise.all(
			tempDirectoryList.map(tempDirectory => {
				return rm(tempDirectory, {
					recursive: true,
					force: true,
				});
			})
		);
		tempDirectoryList.length = 0;
	});

	it("applies package.json and tsconfig changes for all workspace dependencies", async () => {
		const libPackagePath = path.resolve(fixturePath, "packages/lib");
		const appPackagePath = path.resolve(fixturePath, "packages/app");
		const unrelatedPackagePath = path.resolve(fixturePath, "packages/unrelated");

		await applyAllWorkspacePackages([libPackagePath, appPackagePath, unrelatedPackagePath]);

		expect(await readPackageJsonRelevant(path.resolve(libPackagePath, "package.json"))).toMatchInlineSnapshot(`
			{
			  "exports": {
			    "./model": {
			      "import": "./build/model/index.js",
			    },
			    "./package.json": "./package.json",
			    "./test/another": {
			      "import": "./build/test/another.js",
			    },
			  },
			}
		`);

		expect(await readTsConfigRelevant(path.resolve(libPackagePath, "tsconfig.json"))).toMatchInlineSnapshot(`
			{
			  "compilerOptions": {
			    "composite": true,
			    "paths": {
			      "@example/multiple-tsconfigs": [
			        "../multiple-tsconfigs/src/index",
			      ],
			    },
			  },
			  "references": [
			    {
			      "path": "../multiple-tsconfigs/tsconfig.build.json",
			    },
			  ],
			}
		`);

		expect(await readPackageJsonRelevant(path.resolve(appPackagePath, "package.json"))).toMatchInlineSnapshot(`
			{
			  "exports": {
			    ".": {
			      "import": "./dist/index.js",
			    },
			    "./package.json": "./package.json",
			  },
			}
		`);

		expect(await readTsConfigRelevant(path.resolve(appPackagePath, "tsconfig.json"))).toMatchInlineSnapshot(`
			{
			  "compilerOptions": {
			    "composite": true,
			    "paths": {
			      "@example/lib/model": [
			        "../lib/src/model/index",
			      ],
			      "@example/lib/test/another": [
			        "../lib/src/test/another",
			      ],
			    },
			  },
			  "references": [
			    {
			      "path": "../lib",
			    },
			  ],
			}
		`);

		expect(await readTsConfigRelevant(path.resolve(appPackagePath, "tsconfig.build.json"))).toMatchInlineSnapshot(`
			{
			  "references": [
			    {
			      "path": "../lib",
			    },
			  ],
			}
		`);

		expect(await readPackageJsonRelevant(path.resolve(unrelatedPackagePath, "package.json"))).toMatchInlineSnapshot(`
			{
			  "exports": {
			    ".": {
			      "import": "./dist/index.js",
			    },
			    "./package.json": "./package.json",
			  },
			}
		`);

		expect(await readTsConfigRelevant(path.resolve(unrelatedPackagePath, "tsconfig.json"))).toMatchInlineSnapshot(`
			{
			  "compilerOptions": {
			    "composite": true,
			  },
			}
		`);
	});

	it("applies commonjs root export after copying full workspace directory", async () => {
		const packagePath = path.resolve(fixturePath, "packages/app");
		const packageJsonPath = path.resolve(packagePath, "package.json");
		const packageJson = (await PackageJsonFile.load(packageJsonPath)).content;

		await writeFile(
			packageJsonPath,
			`${JSON.stringify(
				{
					...packageJson,
					entrysmith: {
						...(packageJson.entrysmith as Record<string, unknown>),
						entrypointOutputMode: "cjs",
					},
				},
				null,
				2
			)}\n`,
			"utf8"
		);

		await apply(packagePath);

		expect(await readPackageJsonRelevant(packageJsonPath)).toMatchInlineSnapshot(`
			{
			  "exports": {
			    ".": {
			      "default": "./dist/index.js",
			    },
			    "./package.json": "./package.json",
			  },
			}
		`);
	});

	it("stores path mappings in parent tsconfig when child extends it", async () => {
		const packagePath = path.resolve(fixturePath, "packages/app");
		const packageJsonPath = path.resolve(packagePath, "package.json");
		const packageJson = (await PackageJsonFile.load(packageJsonPath)).content;
		const entrysmith = packageJson.entrysmith as Record<string, unknown>;
		const typescript = (entrysmith.typescript ?? {}) as Record<string, unknown>;

		await writeFile(
			packageJsonPath,
			`${JSON.stringify(
				{
					...packageJson,
					entrysmith: {
						...entrysmith,
						typescript: {
							...typescript,
							referenceTsConfigPaths: ["tsconfig.base.json", "tsconfig.json"],
						},
					},
				},
				null,
				2
			)}\n`,
			"utf8"
		);

		await writeFile(
			path.resolve(packagePath, "tsconfig.base.json"),
			`${JSON.stringify(
				{
					compilerOptions: {
						composite: true,
						paths: {},
					},
					references: [],
				},
				null,
				2
			)}\n`,
			"utf8"
		);

		await writeFile(
			path.resolve(packagePath, "tsconfig.json"),
			`${JSON.stringify(
				{
					extends: "./tsconfig.base.json",
					references: [],
				},
				null,
				2
			)}\n`,
			"utf8"
		);

		await apply(packagePath);

		const parentTsConfig = await readTsConfigFile(path.resolve(packagePath, "tsconfig.base.json"));
		const childTsConfig = await readTsConfigFile(path.resolve(packagePath, "tsconfig.json"));

		expect(toRelevantTsConfigFields(parentTsConfig)).toMatchInlineSnapshot(`
			{
			  "compilerOptions": {
			    "composite": true,
			    "paths": {
			      "@example/lib/model": [
			        "../lib/src/model/index",
			      ],
			      "@example/lib/test/another": [
			        "../lib/src/test/another",
			      ],
			    },
			  },
			  "references": [
			    {
			      "path": "../lib",
			    },
			  ],
			}
		`);

		expect(toRelevantTsConfigFields(childTsConfig)).toMatchInlineSnapshot(`
			{
			  "references": [
			    {
			      "path": "../lib",
			    },
			  ],
			}
		`);
	});
});

async function createFixtureCopy(): Promise<string> {
	const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "entrysmith-apply-"));
	const fixturePath = path.resolve(__dirname, "../../__tests__/example-monorepo");
	const copiedFixturePath = path.resolve(tempDirectory, "example-monorepo");

	tempDirectoryList.push(tempDirectory);

	await cp(fixturePath, copiedFixturePath, {
		recursive: true,
	});

	return copiedFixturePath;
}

async function applyAllWorkspacePackages(packagePathList: string[]): Promise<void> {
	for (const packagePath of packagePathList) {
		await apply(packagePath);
	}
}

async function readPackageJsonRelevant(packageJsonPath: string): Promise<Record<string, unknown>> {
	return toRelevantPackageJsonFields((await PackageJsonFile.load(packageJsonPath)).content);
}

async function readTsConfigRelevant(filePath: string): Promise<Record<string, unknown>> {
	return toRelevantTsConfigFields(await readTsConfigFile(filePath));
}

function toRelevantPackageJsonFields(packageJson: PackageJson): Record<string, unknown> {
	return {
		exports: packageJson.exports,
	};
}

function toRelevantTsConfigFields(tsConfig: TSConfig): Record<string, unknown> {
	return omitUndefinedFields({
		compilerOptions: tsConfig.compilerOptions,
		references: tsConfig.references,
	});
}

function omitUndefinedFields(fields: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(fields).filter(([, value]) => {
			return value !== undefined;
		})
	);
}

async function readTsConfigFile(filePath: string): Promise<TSConfig> {
	return (await TsConfigFile.load(filePath)).content as TSConfig;
}
