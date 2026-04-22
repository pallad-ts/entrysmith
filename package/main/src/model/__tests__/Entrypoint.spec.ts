import { Entrypoint } from "../Entrypoint";

describe("Entrypoint", () => {
	it("parses root index entrypoint", () => {
		expect(Entrypoint.fromString("index.ts")).toMatchInlineSnapshot(`
			Entrypoint {
			  "directory": undefined,
			  "name": "index",
			}
		`);
	});

	it("parses nested index entrypoint", () => {
		expect(Entrypoint.fromString("main/index.ts")).toMatchInlineSnapshot(`
			Entrypoint {
			  "directory": "main",
			  "name": "index",
			}
		`);
	});

	it("parses nested file entrypoint", () => {
		expect(Entrypoint.fromString("main/another.ts")).toMatchInlineSnapshot(`
			Entrypoint {
			  "directory": "main",
			  "name": "another",
			}
		`);
	});

	it("normalizes slashes and leading dot segment", () => {
		expect(Entrypoint.fromString(".\\main\\index.ts")).toMatchInlineSnapshot(`
			Entrypoint {
			  "directory": "main",
			  "name": "index",
			}
		`);
	});

	it("builds source path for root entrypoint", () => {
		const entrypoint = Entrypoint.fromString("index.ts");

		expect(entrypoint.sourcePath("src")).toBe("src/index.ts");
	});

	it("builds source path for nested entrypoint", () => {
		const entrypoint = Entrypoint.fromString("main/index.ts");

		expect(entrypoint.sourcePath("src")).toBe("src/main/index.ts");
	});

	it("rejects parent directory traversal", () => {
		expect(() => Entrypoint.fromString("main/../another.ts")).toThrowErrorMatchingInlineSnapshot(
			`[Error: Entrypoint path cannot contain upper-directory segments: "main/../another.ts".]`
		);
	});

	it("builds destination path for root entrypoint", () => {
		const entrypoint = Entrypoint.fromString("index.ts");

		expect(entrypoint.destinationPath("dist")).toBe("dist/index.js");
	});

	it("builds destination path for nested entrypoint", () => {
		const entrypoint = Entrypoint.fromString("main/another.ts");

		expect(entrypoint.destinationPath("build/esm")).toBe("build/esm/main/another.js");
	});

	it("normalizes destination directory separators", () => {
		const entrypoint = Entrypoint.fromString("main/index.ts");

		expect(entrypoint.destinationPath(".\\dist\\esm")).toBe("dist/esm/main/index.js");
	});
});
