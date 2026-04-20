import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
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
