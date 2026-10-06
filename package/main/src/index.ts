#!/usr/bin/env node

import { Command } from "commander";

import { apply, formatApplySummary } from "./command/apply";

const program = new Command();

program.name("entrysmith");
program.showSuggestionAfterError();
program.exitOverride();

program
	.command("fix", { isDefault: true })
	.description("Fix current package configuration")
	.action(async () => {
		process.stdout.write(`${formatApplySummary(await apply(process.cwd()))}\n`);
	});

void program.parseAsync(process.argv).catch(error => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	process.exit(1);
});
