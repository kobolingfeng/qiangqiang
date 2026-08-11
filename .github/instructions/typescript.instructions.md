---
applyTo: "src/**/*.ts,scripts/**/*.ts"
---

# TypeScript instructions

- Keep code compatible with Bun 1.3.14 and the `strict` TypeScript configuration.
- Frontend code under `src/` must target the browser and must not import Bun or Node-only APIs.
- Keep native command names and result types centralized in `src/api.ts` and `src/ipc.ts`.
- Tooling must use explicit paths, validate external input, and fail with actionable messages.
- Add or update `*.test.ts` coverage for reusable parsing, path, naming, and configuration logic.
- Run `bun run check`, `bun run test`, and the build command appropriate to the changed area.
