# AI-first framework contract

QiangQiang is designed so that an AI coding agent can understand, change, and verify a Windows desktop application without first loading a large framework runtime into context. “AI-friendly” is an engineering constraint here, not only a description.

## The problem

Desktop application stacks often spread behavior across generated bindings, plugins, build systems, and platform-specific modules. That increases the amount of repository context an agent must inspect and makes it harder to prove that a native capability is correctly exposed to application code.

QiangQiang keeps the native boundary deliberately narrow while preserving access to Windows capabilities. Product UI remains ordinary web code; privileged operations pass through one typed IPC contract.

## Contract

| Constraint | Repository proof |
|---|---|
| A predictable native boundary | Native commands are registered in `native/main.cpp`. |
| One typed application API | Public wrappers and event types live in `src/api.ts`. |
| A minimal transport | `src/ipc.ts` implements one request/response/event protocol. |
| Machine-checkable parity | `scripts/api-contract.test.ts` compares native registrations with TypeScript command strings. |
| Explicit agent instructions | `AGENTS.md` and `.github/instructions/` define repository and path-specific rules. |
| Deterministic verification | `bun run check`, `bun run test`, and `bun run package:single` are the canonical gates. |
| Reviewable delivery | A Windows application can be reproduced as one small executable by the release workflow. |
| A defined trust boundary | Only the configured application origin may navigate the main WebView or send privileged IPC messages. |

The current contract covers **93 native commands and 16 events**. The count is asserted by tests so documentation cannot silently drift from the implementation.

## Agent workflow

For a product application created from this framework, an agent should normally:

1. Read `AGENTS.md`, `app.config.json`, and the application files in `src/`.
2. Treat `native/main.cpp`, `src/api.ts`, and `src/ipc.ts` as framework boundaries.
3. Build the UI with vanilla TypeScript or any frontend that emits browser assets.
4. Use the typed API instead of adding ad-hoc native bridges.
5. Run `bun run check` and `bun run test` after changes.
6. Run `bun run package:single` before delivery.

Framework maintainers may change the boundary, but a native API change is complete only when the C++ registration, TypeScript wrapper, tests, and documentation agree.

## Ecosystem role

QiangQiang targets a specific gap: AI-assisted development of small, native-feeling Windows tools that should not require shipping a separate browser or JavaScript runtime. It gives agents familiar HTML/CSS/TypeScript at the application layer and a compact, auditable C++/Win32 substrate underneath.

This is useful for utilities, internal tools, launchers, viewers, and other focused desktop applications where distribution size, native Windows integration, and the ability to audit generated changes matter.

## Reproduce the contract

```bash
bun install --frozen-lockfile
bun run check
bun run test
bun run setup
bun run package:single
```

CI runs the same sequence on Windows. Tagged releases additionally publish a checksum and a GitHub artifact attestation so consumers can connect a binary back to its source and build workflow.

## Non-goals

- QiangQiang is not a general-purpose browser for untrusted remote content.
- It does not hide native capabilities from reviewers behind generated binding code.
- It does not claim that agent-generated code is automatically correct or secure; changes still require tests and human review.
- It currently focuses on Windows 10 and 11 rather than cross-platform abstraction.

---

## 中文摘要

强强把“AI 友好”定义为可验证的工程约束：固定的框架边界、单一类型化 API、极简 IPC 协议、C++/TypeScript 契约测试、明确的代理指令，以及统一的检查、测试和单文件发布命令。它希望填补的生态空白，是让 AI 能以较小上下文和较低歧义开发原生质感的 Windows 小型应用，同时保留可审计的 Win32 底层与轻量交付能力。
