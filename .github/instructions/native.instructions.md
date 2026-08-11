---
applyTo: "native/**/*.cpp,native/**/*.h,native/**/*.rc"
---

# Native code instructions

- Target MSVC with C++20, Unicode Win32 APIs, and x64 WebView2.
- Keep WebView2/COM interaction on the UI thread. Send worker results back through window messages.
- Use RAII for `HANDLE`, `HINTERNET`, COM, and other native resources wherever practical.
- Check every fallible Windows call that affects correctness and preserve cleanup on all error paths.
- Do not perform blocking process, network, or long-running file work in a synchronous IPC handler.
- Bound untrusted or potentially large input/output and preserve valid UTF-8 at the JSON boundary.
- Add the matching typed wrapper in `src/api.ts` for every public IPC command.
- Validate native changes with `bun run setup` and `bun run build:single`.
