import { mkdtemp, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { TsConfigFile } from "../TsConfigFile";

describe("TsConfigFile", () => {
	it("loads exact tsconfig path with JSONC syntax", async () => {
		const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "entrysmith-tsconfig-"));
		const tsConfigPath = path.resolve(tempDirectory, "tsconfig.build.json");

		try {
			await writeFile(
				tsConfigPath,
				`{
				  // comment
				  "compilerOptions": {
				    "composite": true,
				  },
				}
`,
				"utf8"
			);

			expect(await TsConfigFile.load(tsConfigPath)).toMatchObject({
				content: {
					compilerOptions: {
						composite: true,
					},
				},
				path: tsConfigPath,
			});
		} finally {
			await rm(tempDirectory, {
				recursive: true,
				force: true,
			});
		}
	});

	it("detects when another tsconfig extends current one", () => {
		const tsConfig = new TsConfigFile("/project/package/tsconfig.json", {
			extends: "../../tsconfig.base.json",
		});
		const tsConfigBuild = new TsConfigFile("/project/package/tsconfig.build.json", {
			extends: "./tsconfig",
		});
		const tsConfigOther = new TsConfigFile("/project/package/tsconfig.other.json", {
			extends: "../../tsconfig.other-base.json",
		});

		expect(tsConfig.isExtendedBy(tsConfigBuild)).toBe(true);
		expect(tsConfig.isExtendedBy(tsConfigOther)).toBe(false);
	});
});
