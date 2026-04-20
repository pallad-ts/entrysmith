#!/usr/bin/env node

import { Command } from "commander";

import { apply } from "./command/apply";

const program = new Command();

program.name("entrysmith");
program.showSuggestionAfterError();
program.exitOverride();

program
	.command("fix", { isDefault: true })
	.description("Fix current package configuration")
	.action(async () => {
		const result = await apply(process.cwd());

		console.log("done");
	});

void program.parseAsync(process.argv).catch(error => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	process.exit(1);
});
