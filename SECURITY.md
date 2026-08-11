# Security Policy

Security matters because QiangQiang exposes native Windows capabilities to web content through IPC.

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | Yes |
| Latest `main` | Yes |
| Older commits, forks, and generated applications | Best effort |

Until the first stable release, fixes are made on `main` and the latest `0.x` release line. Application authors should update their framework copy when security fixes land.

## Reporting a vulnerability

Please do **not** open a public issue for a suspected vulnerability.

Use GitHub's private vulnerability reporting on the repository's **Security** tab. If that option is unavailable, email `kobolingfeng@gmail.com` with the subject `[QiangQiang Security]` before sharing details publicly.

Include, when possible:

- Affected commit or version
- Windows and WebView2 versions
- Reproduction steps or a minimal proof of concept
- Expected impact and attack prerequisites
- Suggested mitigation, if known

You should receive an acknowledgement within seven days. The maintainer will coordinate validation, remediation, and disclosure timing with the reporter. Please allow a reasonable period for a fix before public disclosure.

## Relevant security areas

Reports are especially useful for IPC permission bypasses, command or argument injection, unsafe path handling, arbitrary file access, update/install behavior, untrusted web content, resource loading, memory safety, handle lifetime, and sensitive-data exposure.

Security hardening suggestions that do not describe an exploitable vulnerability can be submitted as regular issues or pull requests.
