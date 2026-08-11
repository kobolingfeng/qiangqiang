# Roadmap

QiangQiang aims to make small, native-feeling Windows applications straightforward for both human developers and AI coding agents. This roadmap describes direction, not guaranteed dates.

## Current priorities

- Expand regression coverage for the IPC bridge, build tooling, and native edge cases.
- Stabilize the public command/event contract ahead of the first tagged preview release.
- Improve scaffold creation so a new application can start without modifying the framework repository.
- Keep documentation, examples, and machine-readable agent instructions synchronized.
- Strengthen default permissions and guidance for applications that load external content.

## AI-first developer experience

- A dedicated project-creation command with minimal, selectable templates.
- A machine-readable native capability manifest for tools and coding agents.
- API examples and task recipes that agents can retrieve without scanning the full README.
- Automated consistency checks between native handlers, TypeScript wrappers, and documentation.
- Migration notes that let agents update generated applications safely.

## Platform and distribution

- Reproducible tagged releases with checksums and release notes.
- Optional signing guidance for production application distribution.
- Broader accessibility, DPI, multi-monitor, and Windows theme test coverage.
- Continued binary-size and startup-time measurement against representative applications.
- Evaluation of a plugin model that does not compromise the small auditable core.

## Non-goals

- Bundling a browser or JavaScript runtime already supplied by the target Windows system.
- Becoming a cross-platform abstraction at the expense of native Windows behavior.
- Adding large dependencies for features that can remain optional or application-specific.

Proposals are welcome through the repository's feature request form. Explain the user problem, compatibility and security impact, and how the change supports the lightweight or AI-friendly goals.
