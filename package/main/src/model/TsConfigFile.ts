import { ParseError, parse, printParseErrorCode } from "jsonc-parser";
import { writeTSConfig, TSConfig } from "pkg-types";

import { readFile, rm } from "node:fs/promises";
import * as path from "node:path";

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

	get extendsPath(): string | undefined {
		const extendsValue = this.content?.extends;
		if (typeof extendsValue !== "string") {
			return undefined;
		}

		if (extendsValue.startsWith(".")) {
			return path.resolve(path.dirname(this.path), withJsonExtension(extendsValue));
		}

		if (extendsValue.startsWith("/")) {
			return path.resolve(withJsonExtension(extendsValue));
		}

		return extendsValue;
	}

	isExtendedBy(tsConfigFile: TsConfigFile): boolean {
		return tsConfigFile.extendsPath === this.path;
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
			return new TsConfigFile(path, await loadTsConfig(path));
		} catch (error) {
			if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
				return new TsConfigFile(path, undefined);
			}

			throw error;
		}
	}
}

async function loadTsConfig(path: string): Promise<TSConfig> {
	const content = await readFile(path, "utf8");
	const parseErrorList: ParseError[] = [];
	const parsed = parse(content, parseErrorList, {
		allowTrailingComma: true,
		disallowComments: false,
	});

	if (parseErrorList.length > 0) {
		throw new Error(`Failed to parse tsconfig at ${path}: ${printParseErrorCode(parseErrorList[0].error)}`);
	}

	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error(`Expected JSON object in ${path}`);
	}

	return parsed as TSConfig;
}

function withJsonExtension(value: string): string {
	return value.endsWith(".json") ? value : `${value}.json`;
}
