import { writeTSConfig, readTSConfig, TSConfig } from "pkg-types";

import { rm } from "node:fs/promises";

export type TsConfigFileCompilerOptionsPaths = Record<string, string[]>;
export type TsConfigFileReferences = Array<{ path: string }>;
export class TsConfigFile {
	constructor(
		readonly path: string,
		public content: TSConfig | undefined
	) {}

	get compilerOptionsPaths(): TsConfigFileCompilerOptionsPaths | undefined {
		return this.content?.compilerOptions?.paths;
	}

	set compilerOptionsPaths(paths: TsConfigFileCompilerOptionsPaths | undefined) {
		if (paths === undefined) {
			if (this.content) {
				delete this.content.compilerOptions?.paths;
			}
		} else {
			this.content = {
				...this.content,
				compilerOptions: {
					...this.content?.compilerOptions,
					paths,
				},
			};
		}
	}

	get references(): TsConfigFileReferences | undefined {
		return this.content?.references;
	}

	set references(references: TsConfigFileReferences | undefined) {
		if (references === undefined) {
			if (this.content) {
				delete this.content.references;
			}
		} else {
			this.content = {
				...this.content,
				references,
			};
		}
	}

	async save() {
		if (this.content === undefined || Object.keys(this.content).length === 0) {
			await rm(this.path);
			return;
		}
		await writeTSConfig(this.path, this.content);
	}

	static async load(path: string): Promise<TsConfigFile> {
		try {
			return new TsConfigFile(path, await readTSConfig(path));
		} catch (error) {
			if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
				return new TsConfigFile(path, undefined);
			}

			throw error;
		}
	}
}
