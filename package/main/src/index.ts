#!/usr/bin/env node

import { runFix } from "./command/fix";

const [command] = process.argv.slice(2);

void run(command).catch(error => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	process.exitCode = 1;
});

async function run(commandName?: string): Promise<void> {
	if (commandName && commandName !== "fix") {
		throw new Error(`Unknown command "${commandName}". Supported commands: fix`);
	}

	const result = await runFix(process.cwd());

	console.log(
		[
			"entrysmith fixed current package",
			`package.json updated: ${result.packageJsonUpdated ? "yes" : "no"}`,
			`tsconfig references updated: ${result.tsConfigReferenceUpdates}`,
			`tsconfig paths updated: ${result.tsConfigPathUpdates}`,
			`workspace dependencies processed: ${result.workspaceDependencyCount}`,
		].join("\n")
	);
}
