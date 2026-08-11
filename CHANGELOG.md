# Changelog

All notable framework changes are documented here. The format follows the principles of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses semantic versioning.

## [Unreleased]

## [0.1.0] - 2026-08-11

### Added

- Windows CI for type-checking, tests, native compilation, single-executable packaging, and artifact upload.
- Contributor, support, governance, security, and conduct policies.
- Structured bug and feature request forms plus a pull request template.
- Dependabot configuration for Bun and GitHub Actions dependencies.
- Agent instructions for Codex, GitHub Copilot, and other `AGENTS.md`-aware tools.
- Architecture and roadmap documentation.
- A documented, machine-checkable AI-first framework contract.
- Reproducible tagged releases with checksums and GitHub build provenance.

### Changed

- Repository metadata and bilingual README presentation.
- Native API documentation synchronized with the implementation.
- Window state persistence is now exposed through typed TypeScript wrappers.

### Removed

- The undocumented no-op `devtools.close` native command.
- The committed example executable; official binaries now come from reproducible GitHub Releases.

### Security

- Removed machine-specific IDE and MCP configuration from version control.
- Restricted main-WebView navigation and privileged IPC messages to the configured application origin.

## [0.0.1] - 2026-04-12

### Added

- Initial C++20 Win32/WebView2 desktop shell.
- Typed TypeScript IPC API and Bun development/build tooling.
- Portable and embedded single-executable distribution modes.
