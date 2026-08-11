# Agent Guide for QiangQiang

QiangQiang is an AI-friendly, Windows-only desktop application framework. It combines a single C++20 Win32/WebView2 native shell with a typed TypeScript frontend bridge and Bun-based tooling.

## Repository scope

- This repository contains the framework itself and a file-viewer example.
- If a user wants to build an application *with* QiangQiang, create a separate project from the scaffold. Do not turn this framework repository into that application.
- Framework changes belong here: native APIs, IPC, build/dev/package tooling, shared TypeScript wrappers, tests, and documentation.

## Source map

- `native/main.cpp`: native window, WebView2 host, IPC command handlers, and Windows integrations.
- `src/ipc.ts`: request/response and event transport.
- `src/api.ts`: public typed wrappers for native commands. Treat this as the frontend API contract.
- `src/main.ts` and `src/index.html`: example application; keep it useful as a framework demonstration.
- `scripts/`: setup, build, development server, packaging, and their tests.
- `app.config.json`: example/default runtime configuration.
- `dist/`, `release/`, `deps/`, `native/build/`: generated or downloaded; never commit them.

## Canonical commands

Run from the repository root on Windows:

```powershell
bun install --frozen-lockfile
bun run check
bun run test
bun run setup
bun run build:single
```

- `bun run check` and `bun run test` are required for TypeScript or tooling changes.
- `bun run build:frontend` is the minimum build check for frontend-only changes.
- `bun run build:single` is required for native, IPC, build, packaging, or resource changes.

## Change rules

- Keep the native shell small, dependency-light, and Windows-focused.
- Preserve strict TypeScript types; avoid `any` unless the protocol genuinely cannot be narrowed.
- Keep synchronous work off the UI thread. Blocking process, file, or network operations must use the async IPC path.
- Marshal WebView2 calls back to the UI thread and use RAII for Windows/COM handles.
- Validate all values crossing the IPC boundary. Consider permissions, injection, path traversal, output limits, timeouts, and invalid UTF-8.
- When adding or renaming a native command, update `native/main.cpp`, `src/api.ts`, relevant types/events, tests, and both `README.md` and `README.en.md`.
- Do not hand-edit generated artifacts or downloaded dependencies.
- Keep Chinese and English documentation technically equivalent.

## Pull requests

- Make focused changes and explain user-visible behavior and risks.
- Include tests for bug fixes and reusable tooling logic.
- Report the exact validation commands run.
- Never commit local IDE/MCP settings, secrets, credentials, personal paths, or build outputs.

See `CONTRIBUTING.md`, `SECURITY.md`, and `docs/ARCHITECTURE.md` for more detail.
