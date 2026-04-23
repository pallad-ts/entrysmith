import { findTsConfigCommonExtends } from "../findTsConfigCommonExtends";
import { TsConfigFile } from "../TsConfigFile";

describe("findTsConfigCommonExtends", () => {
	it("returns root tsconfig when child extends it", () => {
		const tsConfig = new TsConfigFile("/project/package/tsconfig.json", {
			extends: "../../tsconfig.base.json",
		});
		const tsConfigBuild = new TsConfigFile("/project/package/tsconfig.build.json", {
			extends: "./tsconfig",
		});

		expect(findTsConfigCommonExtends([tsConfig, tsConfigBuild])).toEqual([tsConfig]);
	});

	it("returns one root per extends group", () => {
		const tsConfig = new TsConfigFile("/project/package/tsconfig.json", {
			extends: "../../tsconfig.base.json",
		});
		const tsConfigBuild = new TsConfigFile("/project/package/tsconfig.build.json", {
			extends: "./tsconfig.json",
		});
		const tsConfigUnrelated = new TsConfigFile("/project/package/tsconfig.unrelated.json", {
			extends: "../../tsconfig.other-base.json",
		});

		expect(findTsConfigCommonExtends([tsConfig, tsConfigBuild, tsConfigUnrelated])).toEqual([
			tsConfig,
			tsConfigUnrelated,
		]);
	});

	it("returns only top-level tsconfig for extends chain", () => {
		const root = new TsConfigFile("/project/package/tsconfig.root.json", {
			extends: "../../tsconfig.base.json",
		});
		const middle = new TsConfigFile("/project/package/tsconfig.base.json", {
			extends: "./tsconfig.root.json",
		});
		const child = new TsConfigFile("/project/package/tsconfig.json", {
			extends: "./tsconfig.base",
		});

		expect(findTsConfigCommonExtends([root, middle, child])).toEqual([root]);
	});
});
