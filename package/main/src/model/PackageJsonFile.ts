import { PackageJson, writePackageJSON } from "pkg-types";

import { readFile } from "node:fs/promises";

export class PackageJsonFile {
	constructor(
		readonly path: string,
		public content: PackageJson
	) {}

	get name() {
		return this.content.name;
	}

	*dependencyList(): Generator<{ name: string; version: string }, void, unknown> {
		const list = [
			this.content.dependencies,
			this.content.devDependencies,
			this.content.peerDependencies,
			this.content.optionalDependencies,
		];
		for (const dependencies of list) {
			if (dependencies) {
				for (const [name, version] of Object.entries(dependencies)) {
					yield { name, version };
				}
			}
		}
	}

	set exports(exports: PackageJson["exports"] | undefined) {
		if (exports === undefined) {
			delete this.content.exports;
		} else {
			this.content.exports = exports;
		}
	}

	get exports() {
		return this.content.exports;
	}

	async save() {
		await writePackageJSON(this.path, this.content);
	}

	static async load(path: string): Promise<PackageJsonFile> {
		return new PackageJsonFile(path, JSON.parse(await readFile(path, "utf8")) as PackageJson);
	}
}
