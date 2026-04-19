This fixture provides a minimal workspace monorepo for dependency-loading tests.

- `packages/app` depends on `@example/lib`.
- `packages/lib` has `entrysmith` configuration with two entrypoints.

Suggested usage in tests:

- project path: `package/main/__tests__/example-monorepo/packages/app`
- dependency path: `../lib`
