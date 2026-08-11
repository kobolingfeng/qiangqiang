# Changelog

All notable framework changes are documented here. The format follows the principles of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project intends to use semantic versioning after its first tagged preview release.

## [Unreleased]

### Added

- Windows CI for type-checking, tests, native compilation, single-executable packaging, and artifact upload.
- Contributor, support, governance, security, and conduct policies.
- Structured bug and feature request forms plus a pull request template.
- Dependabot configuration for Bun and GitHub Actions dependencies.
- Agent instructions for Codex, GitHub Copilot, and other `AGENTS.md`-aware tools.
- Architecture and roadmap documentation.

### Changed

- Repository metadata and bilingual README presentation.
- Native API documentation synchronized with the implementation.
- Window state persistence is now exposed through typed TypeScript wrappers.

### Removed

- The undocumented no-op `devtools.close` native command.

### Security

- Removed machine-specific IDE and MCP configuration from version control.

## [0.0.1] - 2026-04-12

### Added

- Initial C++20 Win32/WebView2 desktop shell.
- Typed TypeScript IPC API and Bun development/build tooling.
- Portable and embedded single-executable distribution modes.
