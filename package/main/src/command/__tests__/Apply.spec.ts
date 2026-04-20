import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach } from "vitest";

import { apply } from "../apply";

const tempDirectoryList: string[] = [];

describe("apply", () => {
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

	it("applies module exports and files changes to package.json", async () => {
		const fixturePath = await createFixtureCopy();
		const packagePath = path.resolve(fixturePath, "packages/lib");

		await apply(packagePath);

		const packageJson = await readPackageJson(path.resolve(packagePath, "package.json"));

		expect(packageJson).toMatchObject({
			files: ["build"],
			exports: {
				"./model": {
					import: "./build/model/index.js",
				},
				"./test/another": {
					import: "./build/test/another.js",
				},
				"./package.json": "./package.json",
			},
		});
	});

	it("applies commonjs root export to package.json", async () => {
		const fixturePath = await createFixtureCopy();
		const packagePath = path.resolve(fixturePath, "packages/app");

		await apply(packagePath);

		const packageJson = await readPackageJson(path.resolve(packagePath, "package.json"));

		expect(packageJson).toMatchObject({
			files: ["dist"],
			exports: {
				".": {
					default: "./dist/index.js",
				},
				"./package.json": "./package.json",
			},
		});
	});

	it("applies references and path mappings to tsconfig", async () => {
		const fixturePath = await createFixtureCopy();
		const packagePath = path.resolve(fixturePath, "packages/app");

		await apply(packagePath);

		const tsConfig = await readJsonFile(path.resolve(packagePath, "tsconfig.json"));

		expect(tsConfig).toMatchObject({
			compilerOptions: {
				composite: true,
				paths: {
					"@example/lib/model": ["../lib/src/model/index"],
					"@example/lib/test/another": ["../lib/src/test/another"],
				},
			},
			references: [{ path: "../lib/tsconfig.json" }],
		});
	});

	it("stores path mappings in parent tsconfig when child extends it", async () => {
		const fixturePath = await createFixtureCopy();
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

		expect(parentTsConfig).toMatchObject({
			compilerOptions: {
				paths: {
					"@example/lib/model": ["../lib/src/model/index"],
					"@example/lib/test/another": ["../lib/src/test/another"],
				},
			},
			references: [{ path: "../lib/tsconfig.json" }],
		});

		expect(childTsConfig).toMatchObject({
			extends: "./tsconfig.base.json",
			references: [{ path: "../lib/tsconfig.json" }],
		});
		expect((childTsConfig.compilerOptions as Record<string, unknown> | undefined)?.paths).toBeUndefined();
	});
});

async function createFixtureCopy(): Promise<string> {
	const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "entrysmith-apply-"));
	const fixturePath = path.resolve(__dirname, "../../__tests__/example-monorepo");

	tempDirectoryList.push(tempDirectory);

	await cp(fixturePath, tempDirectory, {
		recursive: true,
	});

	return tempDirectory;
}

async function readPackageJson(packageJsonPath: string): Promise<Record<string, unknown>> {
	const packageJsonContent = await readFile(packageJsonPath, "utf8");
	return JSON.parse(packageJsonContent) as Record<string, unknown>;
}

async function readJsonFile(filePath: string): Promise<Record<string, unknown>> {
	const content = await readFile(filePath, "utf8");
	return JSON.parse(content) as Record<string, unknown>;
}
