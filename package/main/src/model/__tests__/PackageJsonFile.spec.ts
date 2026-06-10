import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach } from "vitest";

import { PackageJsonFile } from "../PackageJsonFile";

const tempDirectoryList: string[] = [];

describe("PackageJsonFile", () => {
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

	it("preserves package.json trailing newline", async () => {
		const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "entrysmith-package-json-"));
		tempDirectoryList.push(tempDirectory);
		const packageJsonPath = path.resolve(tempDirectory, "package.json");
		await writeFile(
			packageJsonPath,
			`${JSON.stringify(
				{
					name: "@example/package",
					version: "1.0.0",
				},
				null,
				2
			)}\n`,
			"utf8"
		);

		const packageJsonFile = await PackageJsonFile.load(packageJsonPath);
		packageJsonFile.content.description = "Loaded package";
		await packageJsonFile.save();

		const content = await readFile(packageJsonPath, "utf8");
		expect(content.endsWith("\n")).toBe(true);
		expect(content.endsWith("\n\n")).toBe(false);
	});

	it("does not fall back to a parent package.json", async () => {
		const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "entrysmith-package-json-"));
		tempDirectoryList.push(tempDirectory);
		const packageDirectory = path.resolve(tempDirectory, "packages/app");
		await mkdir(packageDirectory, { recursive: true });
		await writeFile(
			path.resolve(tempDirectory, "package.json"),
			`${JSON.stringify(
				{
					name: "@example/root",
					version: "1.0.0",
				},
				null,
				2
			)}\n`,
			"utf8"
		);

		await expect(PackageJsonFile.load(path.resolve(packageDirectory, "package.json"))).rejects.toThrow(/ENOENT/);
	});
});
