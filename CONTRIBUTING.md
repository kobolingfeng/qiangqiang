# Contributing to QiangQiang

[中文贡献指南](CONTRIBUTING.zh-CN.md)

Thank you for helping make QiangQiang a smaller, safer, and more AI-friendly Windows application framework.

## Before opening an issue

- Search existing issues and the documentation first.
- Use a bug report for reproducible framework defects and a feature request for proposals.
- Use GitHub Discussions for usage questions and app-design help.
- Report security vulnerabilities privately according to [SECURITY.md](SECURITY.md).

## Development setup

QiangQiang development requires Windows 10/11, Bun 1.3.14 or newer, and Visual Studio Build Tools 2022 with **Desktop development with C++**.

```powershell
bun install
bun run setup
bun run check
bun run test
bun run build:single
```

Generated folders (`dist/`, `release/`, `deps/`, and `native/build/`) are intentionally ignored and must not be committed.

## Where changes belong

- Native APIs and window behavior: `native/main.cpp`
- Public TypeScript API: `src/api.ts`
- IPC transport: `src/ipc.ts`
- Framework tooling: `scripts/`
- Demonstration app: `src/main.ts` and `src/index.html`
- User-facing documentation: keep `README.md` and `README.en.md` technically equivalent

This is the framework repository. Build end-user applications in a separate scaffold rather than replacing the example here with a product-specific app.

## Making a change

1. Fork the repository and create a focused branch from `main`.
2. Keep changes small enough to review and explain the user-visible behavior.
3. Add tests for fixes and reusable tooling logic.
4. Update public types and both READMEs for API or behavior changes.
5. Run the relevant validation:

```powershell
bun run check
bun run test
bun run build:frontend  # frontend-only minimum
bun run build:single    # required for native, IPC, build, packaging, or resource changes
```

## Native API checklist

When adding or changing an IPC command:

- Register and validate the handler in `native/main.cpp`.
- Use async IPC for blocking process, network, or long-running file work.
- Add the typed wrapper and result types in `src/api.ts`.
- Consider permissions, injection, path boundaries, timeouts, output limits, encoding, and handle lifetime.
- Document the command and any event in both READMEs.
- Add focused regression coverage where practical.

## Pull requests

A good pull request includes:

- A concise problem and solution summary
- Linked issues when applicable
- Screenshots or recordings for visible UI changes
- Exact validation commands and results
- Compatibility or security implications
- No generated output, machine-specific configuration, secrets, or unrelated formatting

By contributing, you agree that your contribution is licensed under the repository's [MIT License](LICENSE).
