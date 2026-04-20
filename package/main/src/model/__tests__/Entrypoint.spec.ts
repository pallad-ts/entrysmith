import { Entrypoint } from "../Entrypoint";

describe("Entrypoint", () => {
	it("parses root index entrypoint", () => {
		const entrypoint = Entrypoint.fromString("index.ts");

		expect(entrypoint.unwrap()).toMatchInlineSnapshot(`
			Entrypoint {
			  "directory": undefined,
			  "name": "index",
			}
		`);
	});

	it("parses nested index entrypoint", () => {
		const entrypoint = Entrypoint.fromString("main/index.ts");

		expect(entrypoint.unwrap()).toMatchInlineSnapshot(`
			Entrypoint {
			  "directory": "main",
			  "name": "index",
			}
		`);
	});

	it("parses nested file entrypoint", () => {
		const entrypoint = Entrypoint.fromString("main/another.ts");

		expect(entrypoint.unwrap()).toMatchInlineSnapshot(`
			Entrypoint {
			  "directory": "main",
			  "name": "another",
			}
		`);
	});

	it("normalizes slashes and leading dot segment", () => {
		const entrypoint = Entrypoint.fromString(".\\main\\index.ts");

		expect(entrypoint.unwrap()).toMatchInlineSnapshot(`
			Entrypoint {
			  "directory": "main",
			  "name": "index",
			}
		`);
	});

	it("builds source path for root entrypoint", () => {
		const entrypoint = Entrypoint.fromString("index.ts").unwrap();

		expect(entrypoint.sourcePath("src")).toBe("src/index.ts");
	});

	it("builds source path for nested entrypoint", () => {
		const entrypoint = Entrypoint.fromString("main/index.ts").unwrap();

		expect(entrypoint.sourcePath("src")).toBe("src/main/index.ts");
	});

	it("rejects parent directory traversal", () => {
		const entrypoint = Entrypoint.fromString("main/../another.ts");

		expect(entrypoint.isLeft()).toBe(true);

		if (entrypoint.isLeft()) {
			expect(entrypoint.value).toMatchInlineSnapshot(
				`[Error: Entrypoint path cannot contain upper-directory segments: "main/../another.ts".]`,
			);
		}
	});

	it("builds destination path for root entrypoint", () => {
		const entrypoint = Entrypoint.fromString("index.ts").unwrap();

		expect(entrypoint.destinationPath("dist")).toBe("dist/index.js");
	});

	it("builds destination path for nested entrypoint", () => {
		const entrypoint = Entrypoint.fromString("main/another.ts").unwrap();

		expect(entrypoint.destinationPath("build/esm")).toBe("build/esm/main/another.js");
	});

	it("normalizes destination directory separators", () => {
		const entrypoint = Entrypoint.fromString("main/index.ts").unwrap();

		expect(entrypoint.destinationPath(".\\dist\\esm")).toBe("dist/esm/main/index.js");
	});
});
