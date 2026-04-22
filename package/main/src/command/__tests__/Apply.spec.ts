import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach } from "vitest";

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

		await applyAllWorkspacePackages([libPackagePath, appPackagePath]);

		expect(await readPackageJson(path.resolve(libPackagePath, "package.json"))).toMatchInlineSnapshot(`
			{
			  "entrysmith": {
			    "entrypointOutputMode": "esm",
			    "entrypoints": [
			      "model/index.ts",
			      "test/another.ts",
			    ],
			    "packageOutputDirectory": "build",
			    "typescript": {
			      "referenceTsConfigPaths": [
			        "tsconfig.json",
			      ],
			      "tsConfigTargetPath": "tsconfig.json",
			    },
			  },
			  "exports": {
			    "./model": {
			      "import": "./build/model/index.js",
			    },
			    "./package.json": "./package.json",
			    "./test/another": {
			      "import": "./build/test/another.js",
			    },
			  },
			  "files": [
			    "build",
			  ],
			  "name": "@example/lib",
			  "private": true,
			}
		`);

		expect(await readJsonFile(path.resolve(libPackagePath, "tsconfig.json"))).toMatchInlineSnapshot(`
			{
			  "compilerOptions": {
			    "composite": true,
			  },
			}
		`);

		expect(await readPackageJson(path.resolve(appPackagePath, "package.json"))).toMatchInlineSnapshot(`
			{
			  "dependencies": {
			    "@example/lib": "workspace:*",
			  },
			  "entrysmith": {
			    "entrypointOutputMode": "esm",
			    "entrypoints": [
			      "index.ts",
			    ],
			    "packageOutputDirectory": "dist",
			    "typescript": {
			      "referenceTsConfigPaths": [
			        "tsconfig.json",
			        "tsconfig.build.json",
			      ],
			    },
			  },
			  "exports": {
			    ".": {
			      "import": "./dist/index.js",
			    },
			    "./package.json": "./package.json",
			  },
			  "files": [
			    "dist",
			  ],
			  "name": "@example/app",
			  "private": true,
			}
		`);

		expect(await readJsonFile(path.resolve(appPackagePath, "tsconfig.json"))).toMatchInlineSnapshot(`
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
			      "path": "../lib/tsconfig.json",
			    },
			  ],
			}
		`);

		expect(await readJsonFile(path.resolve(appPackagePath, "tsconfig.build.json"))).toMatchInlineSnapshot(`
			{
			  "exclude": [
			    "__tests__/**/*.test.ts",
			    "__tests__/**/*.spec.ts",
			  ],
			  "extends": "./tsconfig.json",
			  "references": [
			    {
			      "path": "../lib/tsconfig.json",
			    },
			  ],
			}
		`);
	});

	it("applies commonjs root export after copying full workspace directory", async () => {
		const packagePath = path.resolve(fixturePath, "packages/app");
		const packageJsonPath = path.resolve(packagePath, "package.json");
		const packageJson = await readJsonFile(packageJsonPath);

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

		expect(await readPackageJson(packageJsonPath)).toMatchInlineSnapshot(`
			{
			  "dependencies": {
			    "@example/lib": "workspace:*",
			  },
			  "entrysmith": {
			    "entrypointOutputMode": "cjs",
			    "entrypoints": [
			      "index.ts",
			    ],
			    "packageOutputDirectory": "dist",
			    "typescript": {
			      "referenceTsConfigPaths": [
			        "tsconfig.json",
			        "tsconfig.build.json",
			      ],
			    },
			  },
			  "exports": {
			    ".": {
			      "default": "./dist/index.js",
			    },
			    "./package.json": "./package.json",
			  },
			  "files": [
			    "dist",
			  ],
			  "name": "@example/app",
			  "private": true,
			}
		`);
	});

	it("stores path mappings in parent tsconfig when child extends it", async () => {
		const packagePath = path.resolve(fixturePath, "packages/app");
		const packageJsonPath = path.resolve(packagePath, "package.json");
		const packageJson = await readJsonFile(packageJsonPath);
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

		const parentTsConfig = await readJsonFile(path.resolve(packagePath, "tsconfig.base.json"));
		const childTsConfig = await readJsonFile(path.resolve(packagePath, "tsconfig.json"));

		expect(parentTsConfig).toMatchInlineSnapshot(`
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
			      "path": "../lib/tsconfig.json",
			    },
			  ],
			}
		`);

		expect(childTsConfig).toMatchInlineSnapshot(`
			{
			  "extends": "./tsconfig.base.json",
			  "references": [
			    {
			      "path": "../lib/tsconfig.json",
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

async function readPackageJson(packageJsonPath: string): Promise<Record<string, unknown>> {
	const packageJsonContent = await readFile(packageJsonPath, "utf8");
	return JSON.parse(packageJsonContent) as Record<string, unknown>;
}

async function readJsonFile(filePath: string): Promise<Record<string, unknown>> {
	const content = await readFile(filePath, "utf8");
	return JSON.parse(content) as Record<string, unknown>;
}
