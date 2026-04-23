# QiangQiang (强强)

**English** | [中文](README.md) | [LinuxDO](https://linux.do)

---

❤️ **This project is built and maintained by one person in spare time. If you find it useful, please consider sponsoring or contributing to help it grow!**

<a href="https://paypal.me/koboling"><img src="https://img.shields.io/badge/PayPal-Sponsor-blue?logo=paypal&style=for-the-badge" alt="PayPal Sponsor"></a>

<img src="assets/wechat-sponsor.jpg" width="240" alt="WeChat Sponsor QR">

🙏 **Contributions welcome!** Whether it's filing issues, submitting PRs, improving docs, or sharing your experience — all contributions are greatly appreciated. One person can only do so much — let's build QiangQiang together.

---

Ultra-lightweight Windows desktop app framework. C++ Win32 + WebView2 + Bun + TypeScript.

> **884KB** single exe. 90 native APIs. Zero runtime dependencies (WebView2 is built into Windows 10/11).

## Features

- **Tiny** — 884KB single exe with embedded HTML/JS/Config, no external files needed
- **Fast build** — Single-file C++, incremental compile < 2s
- **Full API** — 90 native commands + 15 events + full TypeScript types
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
```

### Develop

```bash
bun run dev      # Hot-reload dev mode (F12 opens DevTools)
```

### Build

```bash
bun run build    # Compiles to dist/
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

### Window Management (16 commands + 9 events)

```typescript
import { win } from './api';

await win.setTitle('My App');
await win.setSize(1280, 720);
await win.center();
await win.maximize();
await win.setAlwaysOnTop(true);
await win.startDrag();  // Custom titlebar dragging

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
        "frameless": true,
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

## Project Structure

```
├── native/
│   ├── main.cpp        # C++ shell (~1000 lines)
│   ├── app.rc          # Resource file
│   └── app.ico         # App icon (replace to customize)
├── src/
│   ├── ipc.ts          # IPC communication bridge
│   ├── api.ts          # TypeScript wrappers for all 90 commands
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

## All Commands (90)

| Category | Commands |
|---|---|
| **Window** | `setTitle` `minimize` `maximize` `restore` `close` `show` `hide` `size` `setSize` `position` `setPosition` `center` `setAlwaysOnTop` `isMaximized` `startDrag` `isFrameless` |
| **Window Config** | `getConfig` `saveState` `loadState` |
| **Dialogs** | `openFile` `saveFile` `openFolder` `message` `confirm` |
| **File System** | `readTextFile` `writeTextFile` `exists` `readDir` `mkdir` `remove` `rename` `stat` |
| **Clipboard** | `readText` `writeText` |
| **Shell** | `open` `execute` |
| **App** | `exit` `dataDir` |
| **Tray** | `create` `setTooltip` `remove` |
| **Environment** | `get` `getAll` |
| **Hotkeys** | `register` `unregister` `unregisterAll` |
| **Notification** | `show` |
| **Menu** | `popup` |
| **HTTP** | `request` |
| **OS** | `platform` `arch` `version` `hostname` `username` `locale` `isDarkMode` `theme` `accentColor` |
| **Paths** | `home` `documents` `desktop` `downloads` `appData` `localAppData` `temp` |
| **Watcher** | `start` `stop` |
| **DevTools** | `open` `close` |

## Events (14)

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
| `tray.click` | — | Tray icon clicked |
| `tray.doubleClick` | — | Tray icon double-clicked |
| `tray.rightClick` | — | Tray icon right-clicked |

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
| Native APIs | 88 | ~30+ | ~70+ | ~50+ |
| Single exe dist | ✓ | ✓ | ✗ | ✗ |
| Runtime overhead | Zero (pure C++) | Go runtime ~5MB | Rust runtime ~2MB | Chromium |
| Asset loading | Zero-copy mmap | Go embed | include_bytes! | asar |

> Data based on comparison tests using the same Vue 3 frontend app (MoXian editor).

## Example App

[`examples/墨线.exe`](examples/) — A Markdown editor built with QiangQiang, only **884 KB** as a single exe. Double-click to run (requires Windows 10/11).

The same app built with Wails as a single file would be **~9 MB** — QiangQiang is less than 1/10 the size, with faster startup and lower memory usage.

## License

MIT
