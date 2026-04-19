import { Entrypoint } from "../Entrypoint";

describe("Entrypoint.fromString", () => {
	it("parses root index entrypoint", () => {
		const entrypoint = Entrypoint.fromString("index.ts");

		expect(entrypoint.unwrap()).toMatchInlineSnapshot(`
			Entrypoint {
			  "name": undefined,
			  "path": "src/index.ts",
			}
		`);
	});

	it("parses nested index entrypoint", () => {
		const entrypoint = Entrypoint.fromString("main/index.ts");

		expect(entrypoint.unwrap()).toMatchInlineSnapshot(`
			Entrypoint {
			  "name": "main",
			  "path": "src/main/index.ts",
			}
		`);
	});

	it("parses nested file entrypoint", () => {
		const entrypoint = Entrypoint.fromString("main/another.ts");

		expect(entrypoint.unwrap()).toMatchInlineSnapshot(`
			Entrypoint {
			  "name": "main/another",
			  "path": "src/main/another.ts",
			}
		`);
	});

	it("normalizes slashes and leading dot segment", () => {
		const entrypoint = Entrypoint.fromString(".\\main\\index.ts");

		expect(entrypoint.unwrap()).toMatchInlineSnapshot(`
			Entrypoint {
			  "name": "main",
			  "path": "src/main/index.ts",
			}
		`);
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
});
