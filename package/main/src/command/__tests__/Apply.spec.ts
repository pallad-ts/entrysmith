import { PackageJson, TSConfig } from "pkg-types";
import { afterEach, beforeEach } from "vitest";

import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { PackageJsonFile } from "../../model/PackageJsonFile";
import { TsConfigFile } from "../../model/TsConfigFile";
import { apply, formatApplySummary } from "../apply";

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
			      "types": "./build/model/index.d.ts",
			    },
			    "./package.json": "./package.json",
			    "./test/another": {
			      "import": "./build/test/another.js",
			      "types": "./build/test/another.d.ts",
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
			      "types": "./dist/index.d.ts",
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
			      "types": "./dist/index.d.ts",
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

	it("applies every configured package from workspace root", async () => {
		const rootPackageJsonPath = path.resolve(fixturePath, "package.json");
		const rootPackageJson = (await PackageJsonFile.load(rootPackageJsonPath)).content;
		const rootPackageJsonWithoutWorkspaceField = Object.fromEntries(
			Object.entries(rootPackageJson).filter(([field]) => field !== "workspaces")
		);
		const libPackageJsonPath = path.resolve(fixturePath, "packages/lib/package.json");
		const libPackageJson = (await PackageJsonFile.load(libPackageJsonPath)).content;
		await writeFile(
			rootPackageJsonPath,
			`${JSON.stringify(
				{
					...rootPackageJsonWithoutWorkspaceField,
					entrysmith: {
						workspaces: ["packages/*"],
					},
				},
				null,
				2
			)}\n`,
			"utf8"
		);
		await writeFile(
			libPackageJsonPath,
			`${JSON.stringify(
				{
					...libPackageJson,
					dependencies: undefined,
				},
				null,
				2
			)}\n`,
			"utf8"
		);

		await apply(fixturePath);

		const libPackageJsonFields = await readPackageJsonRelevant(path.resolve(fixturePath, "packages/lib/package.json"));
		const appPackageJsonFields = await readPackageJsonRelevant(path.resolve(fixturePath, "packages/app/package.json"));
		expect((libPackageJsonFields.exports as Record<string, unknown>)["./model"]).toMatchObject({ import: "./build/model/index.js" });
		expect((appPackageJsonFields.exports as Record<string, unknown>)["."]).toMatchObject({ import: "./dist/index.js" });
		expect(await readTsConfigRelevant(path.resolve(fixturePath, "packages/app/tsconfig.json"))).toMatchObject({
			references: [{ path: "../lib" }],
		});
	});

	it("uses package-manager workspaces when root Entrysmith workspace configuration is absent", async () => {
		const libPackageJsonPath = path.resolve(fixturePath, "packages/lib/package.json");
		const libPackageJson = (await PackageJsonFile.load(libPackageJsonPath)).content;
		await writeFile(
			libPackageJsonPath,
			`${JSON.stringify(
				{
					...libPackageJson,
					dependencies: undefined,
				},
				null,
				2
			)}\n`,
			"utf8"
		);

		const result = await apply(fixturePath);

		expect(result.packageCount).toBe(4);
		const appPackageJson = await readPackageJsonRelevant(path.resolve(fixturePath, "packages/app/package.json"));
		expect((appPackageJson.exports as Record<string, unknown>)["."]).toMatchObject({ import: "./dist/index.js" });
	});

	it("uses Entrysmith workspace configuration instead of package-manager workspaces", async () => {
		const rootPackageJsonPath = path.resolve(fixturePath, "package.json");
		const rootPackageJson = (await PackageJsonFile.load(rootPackageJsonPath)).content;
		await writeFile(
			rootPackageJsonPath,
			`${JSON.stringify(
				{
					...rootPackageJson,
					entrysmith: {
						workspaces: ["packages/app"],
					},
				},
				null,
				2
			)}\n`,
			"utf8"
		);

		const result = await apply(fixturePath);

		expect(result.packageCount).toBe(1);
		expect(await readPackageJsonRelevant(path.resolve(fixturePath, "packages/lib/package.json"))).toEqual({ exports: undefined });
	});

	it("applies default export conditions after copying full workspace directory", async () => {
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
						exportConditions: ["types", "default"],
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
			      "types": "./dist/index.d.ts",
			    },
			    "./package.json": "./package.json",
			  },
			}
		`);
		const packageJsonContent = await readFile(packageJsonPath, "utf8");
		const exportsStartIndex = packageJsonContent.indexOf('"exports"');
		expect(packageJsonContent.indexOf('"types"', exportsStartIndex)).toBeLessThan(
			packageJsonContent.indexOf('"default"', exportsStartIndex)
		);
	});

	it("reports changed files and reports no changes on a repeated apply", async () => {
		const packagePath = path.resolve(fixturePath, "packages/app");

		const firstResult = await apply(packagePath);
		expect({
			changedFilePathList: firstResult.changedFilePathList.map(filePath => path.relative(packagePath, filePath)),
			packageCount: firstResult.packageCount,
		}).toEqual({
			changedFilePathList: ["package.json", "src/index.ts", "tsconfig.build.json", "tsconfig.json"],
			packageCount: 1,
		});

		expect(await apply(packagePath)).toEqual({
			changedFilePathList: [],
			packageCount: 1,
		});
	});

	it("generates flat barrels for configured index entrypoints", async () => {
		const packagePath = path.resolve(fixturePath, "packages/app");
		const sourceDirectory = path.resolve(packagePath, "src");
		await writeFile(path.resolve(sourceDirectory, "zebra.ts"), "export const zebra = true;\n");
		await writeFile(path.resolve(sourceDirectory, "alpha.js"), "export const alpha = true;\n");
		await writeFile(path.resolve(sourceDirectory, "ignored.tsx"), "export const ignored = true;\n");
		await mkdir(path.resolve(sourceDirectory, "nested"));
		await writeFile(path.resolve(sourceDirectory, "nested/example.ts"), "export const example = true;\n");

		await apply(packagePath);

		expect(await readFile(path.resolve(sourceDirectory, "index.ts"), "utf8")).toBe(
			"// generated by entrysmith - don't change\n\nexport * from './alpha';\nexport * from './zebra';\n"
		);
	});

	it("uses configured barrel file extensions and allows barrel generation to be disabled", async () => {
		const packagePath = path.resolve(fixturePath, "packages/app");
		const packageJsonPath = path.resolve(packagePath, "package.json");
		const packageJson = (await PackageJsonFile.load(packageJsonPath)).content;
		const sourceDirectory = path.resolve(packagePath, "src");
		await writeFile(path.resolve(sourceDirectory, "only-ts.ts"), "export const onlyTs = true;\n");
		await writeFile(path.resolve(sourceDirectory, "not-js.js"), "export const notJs = true;\n");

		await writeFile(
			packageJsonPath,
			`${JSON.stringify(
				{
					...packageJson,
					entrysmith: {
						...(packageJson.entrysmith as Record<string, unknown>),
						barrelFileExtensions: ["ts"],
					},
				},
				null,
				2
			)}\n`,
			"utf8"
		);
		await apply(packagePath);
		expect(await readFile(path.resolve(sourceDirectory, "index.ts"), "utf8")).toBe(
			"// generated by entrysmith - don't change\n\nexport * from './only-ts';\n"
		);

		await writeFile(
			packageJsonPath,
			`${JSON.stringify(
				{
					...packageJson,
					entrysmith: {
						...(packageJson.entrysmith as Record<string, unknown>),
						barrelFileExtensions: [],
					},
				},
				null,
				2
			)}\n`,
			"utf8"
		);
		await writeFile(path.resolve(sourceDirectory, "index.ts"), "export const preserved = true;\n");
		await apply(packagePath);
		expect(await readFile(path.resolve(sourceDirectory, "index.ts"), "utf8")).toBe("export const preserved = true;\n");
	});

	it("formats apply summaries for changed and unchanged projects", () => {
		expect(formatApplySummary({ changedFilePathList: ["package.json"], packageCount: 1 })).toBe(
			"Entrysmith updated 1 file across 1 package."
		);
		expect(formatApplySummary({ changedFilePathList: [], packageCount: 3 })).toBe("Entrysmith is up to date.");
	});

	it("applies all configured export conditions", async () => {
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
						exportConditions: ["types", "import", "require"],
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
			      "import": "./dist/index.js",
			      "require": "./dist/index.js",
			      "types": "./dist/index.d.ts",
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
