<p align="center"><img src="native/app.svg" width="96" alt="QiangQiang logo"></p>
<h1 align="center">QiangQiang (强强)</h1>
<p align="center"><strong>An ultra-lightweight Windows desktop framework designed for AI coding agents</strong></p>

<p align="center">
  <a href="https://github.com/kobolingfeng/qiangqiang/actions/workflows/ci.yml"><img src="https://github.com/kobolingfeng/qiangqiang/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/kobolingfeng/qiangqiang?style=flat-square" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Windows-10%20%7C%2011-0078D4?logo=windows&style=flat-square" alt="Windows 10 and 11">
  <img src="https://img.shields.io/badge/Bun-1.3.14-fbf0df?logo=bun&style=flat-square" alt="Bun 1.3.14">
  <img src="https://img.shields.io/badge/C%2B%2B-20-00599C?logo=cplusplus&style=flat-square" alt="C++20">
</p>

<p align="center">
  <strong>English</strong> · <a href="README.md">中文</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="docs/ARCHITECTURE.md">Architecture</a> ·
  <a href="docs/ROADMAP.md">Roadmap</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

QiangQiang combines C++20, Win32, WebView2, Bun, and TypeScript so developers and AI coding agents can build native-feeling Windows applications with familiar web UI technology while keeping the framework small, auditable, and easy to understand.

> **884KB** single executable, **93 native commands + 16 events**, and no separately bundled browser or JavaScript runtime (it uses WebView2 included with Windows 10/11).

## Why AI-friendly

- **Small, explicit context** — One native implementation file, one typed API surface, and predictable generated-directory boundaries.
- **Verifiable contracts** — C++ IPC handlers map to TypeScript types, with canonical check, test, and single-executable build commands.
- **Frontend freedom** — Agents can use vanilla TypeScript, React, Vue, Svelte, or Solid while native capabilities stay behind a stable API.
- **Agent-native guidance** — `AGENTS.md`, GitHub Copilot instructions, architecture documentation, and path-specific coding rules are included.
- **Simple delivery** — HTML, JavaScript, configuration, and the native shell can ship as one tiny executable.

> [!IMPORTANT]
> This is the **framework source repository**. Build product applications in a separate scaffold. AI coding agents should treat `native/main.cpp`, `src/api.ts`, and `src/ipc.ts` as framework boundaries and normally work only in the new project's application layer. Edit this repository directly only when maintaining the framework.

> [!NOTE]
> QiangQiang is currently pre-preview and Windows-only. The public API may still evolve; follow the [changelog](CHANGELOG.md) and [roadmap](docs/ROADMAP.md).

## Features

- **Tiny** — 884KB single exe with embedded HTML/JS/Config, no external files needed
- **Fast build** — Single-file C++, incremental compile < 2s
- **Full API** — 93 native commands + 16 events + full TypeScript types
- **Frameless window** — DWM shadow + custom titlebar + native resize
- **Native window animations** — Minimize, maximize, restore, show, and close use Win32/DWM transitions
- **Windows 11 theme sync** — Follows system dark/light mode and accent color, including DWM border and frontend CSS variables
- **File viewer example** — The default app is now a usable desktop file viewer with browsing, filtering, text preview, and metadata
- **Hot reload** — `bun run dev` for instant frontend refresh
- **Zero deps** — No Node.js, Electron, or Tauri needed
- **Any frontend** — Use any framework: React / Vue / Svelte / Solid / vanilla TS — anything that outputs HTML/CSS/JS
- **Windows-only** — Dedicated to Windows, direct Win32 API access

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) — Frontend build tool & scripts
- [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) — C++ compiler (select "Desktop development with C++")

### Install

```bash
bun install
bun run setup    # Downloads WebView2 SDK + JSON library
bun run check    # Type-check framework and tooling
bun run test     # Run automated tests
```

### Develop

```bash
bun run dev      # Hot-reload dev mode (F12 opens DevTools)
```

### Build

```bash
bun run build            # Compile frontend + native shell
bun run build:native     # Native shell only
bun run build:frontend   # Frontend only
bun run build:single     # Embed frontend into one executable
```

### Package

```bash
bun run package  # Creates release/强强文件查看器-portable.zip
bun run package:single  # Creates release/强强文件查看器-single.zip (single exe only)
```

## Built-In Example: File Viewer

The default `src/` app is a working file viewer that demonstrates QiangQiang's window animations, Windows theme sync, and native file system APIs:

- Directory and file list with filtering, sorting, parent navigation, and refresh
- Text/code preview for common source, Markdown, JSON, log, and plain-text files
- Metadata panel with path, type, size, and modified time
- Native dialogs for opening files/folders, plus external open and Explorer reveal
- Live Windows 11 dark/light mode and accent color sync

## API Overview

### Window Management (17 commands + 9 events)

```typescript
import { win } from './api';

await win.setTitle('My App');
await win.setSize(1280, 720);
await win.center();
await win.maximize();
await win.setAlwaysOnTop(true);
await win.startDrag();  // Custom titlebar dragging
await win.startResize('bottom-right'); // Custom edge/corner resize

// Event listeners
win.onResized(({ w, h }) => console.log(`${w}×${h}`));
win.onFocus(() => console.log('focused'));
win.onFileDrop(({ files }) => console.log('dropped:', files));
```

### Dialogs (5 commands)

```typescript
import { dialog } from './api';

const path = await dialog.openFile({
    filters: [{ name: 'Images', extensions: ['png', 'jpg'] }],
    multiple: true
});
const savePath = await dialog.saveFile({ defaultName: 'output.txt' });
const ok = await dialog.confirm('Confirm', 'Continue?');
```

### File System (8 commands)

```typescript
import { fs } from './api';

const content = await fs.readTextFile('C:\\data\\config.json');
await fs.writeTextFile('C:\\data\\output.txt', 'Hello');
const entries = await fs.readDir('C:\\Users');
const stat = await fs.stat('C:\\Windows\\notepad.exe');
```

### HTTP Client (bypasses CORS)

```typescript
import { http } from './api';

const res = await http.get('https://api.github.com/repos/user/repo');
console.log(JSON.parse(res.body));

const res2 = await http.post('https://httpbin.org/post',
    JSON.stringify({ key: 'value' }),
    { 'Content-Type': 'application/json' }
);
```

### Global Hotkeys

```typescript
import { hotkey, MOD, VK } from './api';

await hotkey.register(1, MOD.CONTROL | MOD.SHIFT, VK.A);
hotkey.onTriggered(({ id }) => {
    if (id === 1) console.log('Ctrl+Shift+A triggered!');
});
```

### Context Menu

```typescript
import { menu } from './api';

const idx = await menu.popup([
    { label: 'Copy' },
    { label: 'Paste' },
    '-',  // separator
    { label: 'Delete', disabled: true },
]);
if (idx === 0) { /* copy */ }
```

### System Tray

```typescript
import { tray, menu, app, win } from './api';

await tray.create('My App');
tray.onClick(() => win.show());
tray.onRightClick(async () => {
    const idx = await menu.popup([
        { label: 'Show' },
        { label: 'Quit' },
    ]);
    if (idx === 1) app.exit();
});
```

### Notifications

```typescript
import { notification } from './api';

await notification.show('Download Complete', 'File saved to desktop');
```

### File Watcher

```typescript
import { watcher } from './api';

const id = await watcher.start('C:\\my-project\\src');
watcher.onChange(({ action, path }) => {
    console.log(`${action}: ${path}`);
});
await watcher.stop(id);
```

### More APIs

```typescript
import { os, path, env, clipboard, shell, devtools } from './api';

// System info
await os.version();   // "10.0.22631"
await os.hostname();  // "MY-PC"
await os.username();  // "admin"
await os.locale();    // "zh-CN"

// Special directories
await path.home();       // "C:\Users\admin"
await path.documents();  // "C:\Users\admin\Documents"
await path.downloads();  // "C:\Users\admin\Downloads"
await path.temp();       // temp directory

// Environment variables
await env.get('PATH');
await env.getAll();

// Clipboard
await clipboard.writeText('Hello!');
const text = await clipboard.readText();

// Shell
await shell.open('https://github.com');
await shell.execute('notepad.exe', ['file.txt']);

// DevTools (dev mode only)
await devtools.open();
```

## Configuration

`app.config.json`:

```json
{
    "window": {
        "title": "My App",
        "width": 1024,
        "height": 768,
        "minWidth": 400,
        "minHeight": 300,
        "center": true,
        "visible": true,
        "showWhenReady": true,
        "frameless": true,
        "saveWindowState": true,
        "titleBarHeight": 40,
        "borderSize": 6,
        "backgroundColor": "#1a1a2e",
        "followSystemTheme": true,
        "lightBackgroundColor": "#f6f6f9",
        "darkBackgroundColor": "#1a1a2e",
        "singleInstance": true
    },
    "dev": {
        "port": 3000
    }
}
```

Window sizing uses the WebView client area. When `frameless` is `false`, QiangQiang converts `width`, `height`, `minWidth`, and `minHeight` to the correct native outer-window dimensions. `showWhenReady` (default `true`) keeps the window hidden until WebView2 paints its first frame, eliminating the blank/native-framed startup flash; set it to `false` to reveal the window as soon as it is created. Use `visible: false` for a delayed first show after the frontend is ready, and `saveWindowState: false` when an app should always reopen with its configured size.

## Project Structure

```
├── native/
│   ├── main.cpp        # C++20 native shell
│   ├── app.rc          # Resource file
│   └── app.ico         # App icon (replace to customize)
├── src/
│   ├── ipc.ts          # IPC communication bridge
│   ├── api.ts          # TypeScript wrappers for all 93 commands
│   ├── main.ts         # File viewer example frontend
│   └── index.html      # Entry page
├── scripts/
│   ├── setup.ts        # Download dependencies
│   ├── build.ts        # Build frontend + native shell
│   ├── dev.ts          # Dev server + hot reload
│   └── package.ts      # Package for distribution
├── app.config.json     # App configuration
└── package.json
```

## IPC Protocol

Frontend communicates with the native shell via `window.chrome.webview.postMessage`:

```
Request:  { id: number, cmd: string, args: object }
Response: { id: number, result: any } | { id: number, error: string }
Event:    { event: string, data: any }
```

## All Commands (93)

| Category | Commands |
|---|---|
| **Window** | `window.setTitle` `window.minimize` `window.maximize` `window.restore` `window.close` `window.show` `window.hide` `window.size` `window.setSize` `window.position` `window.setPosition` `window.center` `window.setAlwaysOnTop` `window.isMaximized` `window.setBackgroundColor` `window.setEffect` `window.setOpacity` `window.setProgress` `window.startDrag` `window.startResize` `window.isFrameless` |
| **Child windows** | `window.createChild` `window.closeChild` `window.listChildren` |
| **Window config** | `window.getConfig` `window.saveState` `window.loadState` |
| **Dialogs** | `dialog.openFile` `dialog.saveFile` `dialog.openFolder` `dialog.message` `dialog.confirm` |
| **File system** | `fs.readTextFile` `fs.readTextRange` `fs.writeTextFile` `fs.exists` `fs.readDir` `fs.mkdir` `fs.remove` `fs.rename` `fs.stat` |
| **Clipboard** | `clipboard.readText` `clipboard.writeText` |
| **Shell** | `shell.open` `shell.execute` `shell.run` |
| **App** | `app.exit` `app.dataDir` `app.exeDir` `app.extractAsset` `app.checkUpdate` `app.downloadUpdate` `app.installUpdate` |
| **Tray** | `tray.create` `tray.setTooltip` `tray.remove` |
| **Environment** | `env.get` `env.getAll` |
| **Hotkeys** | `hotkey.register` `hotkey.unregister` `hotkey.unregisterAll` |
| **Notification** | `notification.show` |
| **Menu** | `menu.popup` |
| **HTTP** | `http.request` |
| **OS** | `os.platform` `os.arch` `os.version` `os.hostname` `os.username` `os.locale` `os.isDarkMode` `os.theme` `os.accentColor` |
| **Paths** | `path.home` `path.documents` `path.desktop` `path.downloads` `path.appData` `path.localAppData` `path.temp` |
| **Watcher** | `watcher.start` `watcher.stop` |
| **DevTools** | `devtools.open` |
| **Registry** | `registry.read` `registry.write` `registry.delete` `registry.exists` |
| **Deep links** | `protocol.register` `protocol.unregister` |
| **Logging** | `log.setFile` `log.write` `log.clear` `log.getPath` |

## Events (16)

| Event | Data | Description |
|---|---|---|
| `window.focus` | — | Window gained focus |
| `window.blur` | — | Window lost focus |
| `window.maximized` | — | Window maximized |
| `window.minimized` | — | Window minimized |
| `window.restored` | — | Window restored |
| `window.resized` | `{ w, h }` | Window resized |
| `window.moved` | `{ x, y }` | Window moved |
| `window.closing` | — | Window about to close |
| `window.fileDrop` | `{ files, x, y }` | Files dropped onto window |
| `hotkey.triggered` | `{ id }` | Global hotkey triggered |
| `watcher.changed` | `{ id, action, path }` | File system change |
| `window.childClosed` | `{ id }` | Child window closed |
| `tray.click` | — | Tray icon clicked |
| `tray.doubleClick` | — | Tray icon double-clicked |
| `tray.rightClick` | — | Tray icon right-clicked |
| `os.themeChanged` | `{ dark, accentColor, backgroundColor, foregroundColor }` | System theme changed |

## Custom Icon

Replace `native/app.ico` with your icon file and rebuild with `bun run build`.

Recommended sizes: 16×16, 32×32, 48×48, 256×256.

## Comparison

| | QiangQiang | Wails | Tauri | Electron |
|---|---|---|---|---|
| Single exe size | **884 KB** | ~9 MB | ~2 MB | ~120 MB |
| Memory usage | ~30 MB | ~50 MB | ~40 MB | ~150 MB |
| Startup time | **~0.5s** | ~1s | ~0.5s | ~2s |
| Build time | ~2s | ~10s | ~10s | N/A |
| Cross-platform | Windows only | ✓ | ✓ | ✓ |
| Frontend freedom | Full | Full | Full | Full |
| Native APIs | 93 | ~30+ | ~70+ | ~50+ |
| Single exe dist | ✓ | ✓ | ✗ | ✗ |
| Runtime overhead | Zero (pure C++) | Go runtime ~5MB | Rust runtime ~2MB | Chromium |
| Asset loading | Zero-copy mmap | Go embed | include_bytes! | asar |

> Data based on comparison tests using the same Vue 3 frontend app (MoXian editor).

## Example App

[`examples/墨线.exe`](examples/) — A Markdown editor built with QiangQiang, only **884 KB** as a single exe. Double-click to run (requires Windows 10/11).

The same app built with Wails as a single file would be **~9 MB** — QiangQiang is less than 1/10 the size, with faster startup and lower memory usage.

## Community and maintenance

- Read the [contribution guide](CONTRIBUTING.md) before opening a pull request.
- Use [GitHub Discussions](https://github.com/kobolingfeng/qiangqiang/discussions) for questions and app ideas.
- Follow the [security policy](SECURITY.md) for private vulnerability reports.
- See the [architecture](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md), and [changelog](CHANGELOG.md).
- Chinese-language discussion is also welcome on [LinuxDO](https://linux.do).

## Support the project

QiangQiang is maintained independently in the maintainer's spare time. Contributions, issue reports, documentation, and sponsorship all help sustain the project.

<a href="https://paypal.me/koboling"><img src="https://img.shields.io/badge/PayPal-Sponsor-blue?logo=paypal&style=flat-square" alt="PayPal Sponsor"></a>

<details>
<summary>WeChat sponsorship</summary>

<img src="assets/wechat-sponsor.jpg" width="240" alt="WeChat Sponsor QR">
</details>

## License

QiangQiang is available under the [MIT License](LICENSE).
