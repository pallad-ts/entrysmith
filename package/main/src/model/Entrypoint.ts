import { fromTry, type Either } from "@sweet-monads/either";

import * as path from "node:path";

import { normalizePath } from "../util/normalizePath";

const SOURCE_DIRECTORY_PREFIX = "src/";
const INDEX_SEGMENT = "/index";

export class Entrypoint {
	constructor(
		readonly name: string | undefined,
		readonly path: string
	) {
		if (path.length === 0) {
			throw new Error("Entrypoint path cannot be empty.");
		}

		if (name !== undefined && name.length === 0) {
			throw new Error("Entrypoint name cannot be empty.");
		}
	}

	static fromString(input: string): Either<Error, Entrypoint> {
		return fromTry(() => {
			const trimmedInput = input.trim();

			if (trimmedInput.length === 0) {
				throw new Error("Entrypoint path cannot be empty.");
			}

			assertNoParentDirectoryReference(trimmedInput);

			const normalizedPath = normalizePath(trimmedInput.replace(/^\.[\\/]/, ""));

			if (path.posix.isAbsolute(normalizedPath)) {
				throw new Error(`Entrypoint path must be relative: "${input}".`);
			}

			if (normalizedPath === "src") {
				throw new Error(`Entrypoint path "${input}" does not point to a file inside src directory.`);
			}

			const pathRelativeToSource = normalizedPath.startsWith(SOURCE_DIRECTORY_PREFIX)
				? normalizedPath.slice(SOURCE_DIRECTORY_PREFIX.length)
				: normalizedPath;

			if (pathRelativeToSource.length === 0 || pathRelativeToSource === ".") {
				throw new Error(`Entrypoint path "${input}" does not point to a file inside src directory.`);
			}

			const pathWithSourcePrefix = `${SOURCE_DIRECTORY_PREFIX}${pathRelativeToSource}`;
			const pathWithoutExtension = removeExtension(pathRelativeToSource);

			if (pathWithoutExtension === "index") {
				return new Entrypoint(undefined, pathWithSourcePrefix);
			}

			if (pathWithoutExtension.endsWith(INDEX_SEGMENT)) {
				return new Entrypoint(pathWithoutExtension.slice(0, -INDEX_SEGMENT.length), pathWithSourcePrefix);
			}

			return new Entrypoint(pathWithoutExtension, pathWithSourcePrefix);
		});
	}
}

function removeExtension(value: string): string {
	const extension = path.posix.extname(value);
	if (extension.length === 0) {
		return value;
	}

	return value.slice(0, -extension.length);
}

function assertNoParentDirectoryReference(input: string): void {
	const normalizedSeparatorsInput = input.replace(/\\/g, "/");
	const hasParentDirectoryReference = normalizedSeparatorsInput.split("/").some(segment => segment === "..");

	if (hasParentDirectoryReference) {
		throw new Error(`Entrypoint path cannot contain upper-directory segments: "${input}".`);
	}
}
