# QiangQiang repository instructions

QiangQiang is a Windows-only, AI-friendly desktop framework: a C++20 Win32/WebView2 shell, a typed TypeScript IPC API, and Bun tooling.

- Read and follow `AGENTS.md` before changing code.
- Keep application-specific work out of this framework repository; use a separate scaffold for user applications.
- Treat `native/main.cpp` and `src/api.ts` as the two sides of one public API contract.
- Preserve strict TypeScript types and the dependency-light single-file native architecture.
- Never block the Win32 UI thread; use async IPC for process, network, or other blocking work.
- Validate IPC inputs and consider permissions, injection, path traversal, output limits, timeouts, encoding, and handle lifetime.
- Never edit or commit `dist/`, `release/`, `deps/`, `native/build/`, local IDE settings, MCP configuration, secrets, or personal paths.
- Run `bun run check` and `bun run test`. Run `bun run build:single` for native, IPC, build, packaging, or resource changes.
- Update both Chinese and English documentation when behavior or the public API changes.
