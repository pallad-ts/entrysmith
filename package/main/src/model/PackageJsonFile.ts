import { PackageJson, readPackageJSON, writePackageJSON } from "pkg-types";

import { isDeepStrictEqual } from "node:util";

import { normalizePath } from "../util/normalizePath";

export class PackageJsonFile {
	private readonly originalContent: PackageJson;

	constructor(
		readonly path: string,
		public content: PackageJson
	) {
		this.originalContent = structuredClone(content);
	}

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

	async save(): Promise<boolean> {
		if (isDeepStrictEqual(this.content, this.originalContent)) {
			return false;
		}

		await writePackageJSON(this.path, this.content);
		return true;
	}

	static async load(path: string): Promise<PackageJsonFile> {
		const normalizedPath = normalizePath(path);
		return new PackageJsonFile(
			path,
			(await readPackageJSON(path, {
				test: filePath => normalizePath(filePath) === normalizedPath,
			})) as PackageJson
		);
	}
}
