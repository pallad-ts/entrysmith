import { fromTry, type Either } from "@sweet-monads/either";

import * as path from "node:path";

import { normalizePath } from "../util/normalizePath";

const SOURCE_DIRECTORY_PREFIX = "src/";

export class Entrypoint {
	constructor(
		readonly name: string,
		readonly directory: string | undefined
	) {
		if (name.length === 0) {
			throw new Error("Entrypoint name cannot be empty.");
		}

		if (directory !== undefined && directory.length === 0) {
			throw new Error("Entrypoint directory cannot be empty.");
		}
	}

	sourcePath(sourceDirectory: string): string {
		const normalizedSourceDirectory = normalizePath(sourceDirectory);
		return path.posix.join(normalizedSourceDirectory, `${this.fullName}.ts`);
	}

	destinationPath(destinationDirectory: string): string {
		const normalizedDestinationDirectory = normalizePath(destinationDirectory);
		return path.posix.join(normalizedDestinationDirectory, `${this.fullName}.js`);
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

			const pathWithoutExtension = removeExtension(pathRelativeToSource);
			const name = path.posix.basename(pathWithoutExtension);
			const directory = path.posix.dirname(pathWithoutExtension);

			return new Entrypoint(name, directory === "." ? undefined : directory);
		});
	}

	get fullName(): string {
		if (this.directory === undefined) {
			return this.name;
		}

		return path.posix.join(this.directory, this.name);
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
