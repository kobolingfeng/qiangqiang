# 强强 (QiangQiang)

[English](README.en.md) | **中文** | [LinuxDO](https://linux.do)

<a href="https://paypal.me/koboling"><img src="https://img.shields.io/badge/PayPal-Sponsor-blue?logo=paypal" alt="PayPal"></a>

<details>
<summary>微信赞赏</summary>
<img src="assets/wechat-sponsor.jpg" width="240" alt="微信赞赏码">
</details>

超轻量 Windows 桌面应用框架。C++ Win32 + WebView2 + Bun + TypeScript。

> 仅 **687KB** 单 exe，80 个原生 API，零运行时依赖（WebView2 已内置于 Windows 10/11）。

## 特性

- **极小体积** — 单 exe 687KB（含嵌入 HTML/JS/Config），无需任何外部文件
- **极快编译** — 单文件 C++，增量编译 < 2s
- **完整 API** — 80 个原生命令 + 14 个事件 + 完整 TypeScript 类型
- **无边框窗口** — DWM 阴影 + 自定义标题栏 + 原生缩放
- **热重载开发** — `bun run dev` 一键启动，前端修改实时刷新
- **零依赖** — 不需要 Node.js、Electron、Tauri 等
- **单 exe 分发** — `bun run build:single` 一个 exe 包含所有资源
- **前端自由** — 支持任何框架：React / Vue / Svelte / Solid / 原生 TS，只要输出 HTML/CSS/JS
- **仅 Windows** — 专注 Windows 平台，API 直达系统底层

## 快速开始

### 前置要求

- [Bun](https://bun.sh) — 前端构建 + 脚本
- [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) — C++ 编译器（勾选"使用 C++ 的桌面开发"）

### 安装

```bash
bun install
bun run setup    # 下载 WebView2 SDK + JSON 库
```

### 开发

```bash
bun run dev      # 热重载开发模式（F12 打开 DevTools）
```

### 构建

```bash
bun run build          # 编译到 dist/（exe + HTML + config）
bun run build:single   # 编译单 exe（HTML/JS 嵌入资源段）
```

### 打包

```bash
bun run package  # 生成 release/强强-portable.zip
```

## API 总览

### 窗口管理 (16 命令 + 9 事件)

```typescript
import { win } from './api';

await win.setTitle('我的应用');
await win.setSize(1280, 720);
await win.center();
await win.maximize();
await win.setAlwaysOnTop(true);
await win.startDrag();  // 自定义标题栏拖拽

// 事件监听
win.onResized(({ w, h }) => console.log(`${w}×${h}`));
win.onFocus(() => console.log('获得焦点'));
win.onFileDrop(({ files }) => console.log('拖入文件:', files));
```

### 对话框 (5 命令)

```typescript
import { dialog } from './api';

const path = await dialog.openFile({
    filters: [{ name: '图片', extensions: ['png', 'jpg'] }],
    multiple: true
});
const savePath = await dialog.saveFile({ defaultName: 'output.txt' });
const ok = await dialog.confirm('确认', '是否继续？');
```

### 文件系统 (8 命令)

```typescript
import { fs } from './api';

const content = await fs.readTextFile('C:\\data\\config.json');
await fs.writeTextFile('C:\\data\\output.txt', 'Hello');
const entries = await fs.readDir('C:\\Users');
const stat = await fs.stat('C:\\Windows\\notepad.exe');
```

### HTTP 客户端 (绕过 CORS)

```typescript
import { http } from './api';

const res = await http.get('https://api.github.com/repos/user/repo');
console.log(JSON.parse(res.body));

const res2 = await http.post('https://httpbin.org/post', 
    JSON.stringify({ key: 'value' }),
    { 'Content-Type': 'application/json' }
);
```

### 全局快捷键

```typescript
import { hotkey, MOD, VK } from './api';

await hotkey.register(1, MOD.CONTROL | MOD.SHIFT, VK.A);
hotkey.onTriggered(({ id }) => {
    if (id === 1) console.log('Ctrl+Shift+A 触发！');
});
```

### 右键菜单

```typescript
import { menu } from './api';

const idx = await menu.popup([
    { label: '复制' },
    { label: '粘贴' },
    '-',  // 分隔线
    { label: '删除', disabled: true },
]);
if (idx === 0) { /* 复制 */ }
```

### 系统托盘

```typescript
import { tray } from './api';

await tray.create('我的应用');
tray.onClick(() => win.show());
tray.onRightClick(async () => {
    const idx = await menu.popup([
        { label: '显示' },
        { label: '退出' },
    ]);
    if (idx === 1) app.exit();
});
```

### 系统通知

```typescript
import { notification } from './api';

await notification.show('下载完成', '文件已保存到桌面');
```

### 文件监听

```typescript
import { watcher } from './api';

const id = await watcher.start('C:\\my-project\\src');
watcher.onChange(({ action, path }) => {
    console.log(`${action}: ${path}`);
});
// 不需要时停止
await watcher.stop(id);
```

### 注册表

```typescript
import { registry } from './api';

// 读写注册表
const value = await registry.read('HKCU', 'Software\\MyApp', 'setting');
await registry.write('HKCU', 'Software\\MyApp', 'setting', 'hello');
await registry.delete('HKCU', 'Software\\MyApp', 'setting');
const exists = await registry.exists('HKCU', 'Software\\MyApp');
```

### 深度链接

```typescript
import { protocol } from './api';

// 注册自定义 URL 协议 → myapp://action/param
await protocol.register('myapp', '我的应用协议');
// 取消注册
await protocol.unregister('myapp');
```

### 日志系统

```typescript
import { log } from './api';

await log.setFile();  // 默认 data/app.log
await log.info('应用已启动');
await log.warn('配置缺失');
await log.error('操作失败');
```

### 其他 API

```typescript
import { os, path, env, clipboard, shell, devtools } from './api';

// 系统信息
await os.version();   // "10.0.22631"
await os.hostname();  // "MY-PC"
await os.username();  // "admin"
await os.locale();    // "zh-CN"

// 特殊目录
await path.home();       // "C:\Users\admin"
await path.documents();  // "C:\Users\admin\Documents"
await path.downloads();  // "C:\Users\admin\Downloads"
await path.desktop();    // "C:\Users\admin\Desktop"
await path.temp();       // "C:\Users\admin\AppData\Local\Temp\"

// 环境变量
await env.get('PATH');
await env.getAll();

// 剪贴板
await clipboard.writeText('Hello!');
const text = await clipboard.readText();

// Shell
await shell.open('https://github.com');
await shell.execute('notepad.exe', ['file.txt']);

// DevTools (开发模式)
await devtools.open();
```

## 配置文件

`app.config.json`:

```json
{
    "window": {
        "title": "我的应用",
        "width": 1024,
        "height": 768,
        "minWidth": 400,
        "minHeight": 300,
        "frameless": true,
        "titleBarHeight": 40,
        "borderSize": 6,
        "backgroundColor": "#1a1a2e",
        "singleInstance": true,
        "splash": true
    },
    "dev": {
        "port": 3000
    }
}
```

## 项目结构

```
├── native/
│   ├── main.cpp        # C++ 壳 (~1000 行)
│   ├── app.rc          # 资源文件
│   └── app.ico         # 应用图标（替换此文件自定义图标）
├── src/
│   ├── ipc.ts          # IPC 通信桥
│   ├── api.ts          # 全部 80 个命令的 TypeScript 类型封装
│   ├── main.ts         # 示例前端
│   └── index.html      # 入口页面
├── scripts/
│   ├── setup.ts        # 下载依赖
│   ├── build.ts        # 编译前端 + 原生壳
│   ├── dev.ts          # 开发服务器 + 热重载
│   └── package.ts      # 打包
├── app.config.json     # 应用配置
└── package.json
```

## IPC 协议

前端通过 `window.chrome.webview.postMessage` 与原生壳通信：

```
请求: { id: number, cmd: string, args: object }
响应: { id: number, result: any } | { id: number, error: string }
事件: { event: string, data: any }
```

## 全部命令列表 (80 个)

| 分类 | 命令 | 说明 |
|---|---|---|
| **窗口** | `window.setTitle` `window.minimize` `window.maximize` `window.restore` `window.close` `window.show` `window.hide` `window.size` `window.setSize` `window.position` `window.setPosition` `window.center` `window.setAlwaysOnTop` `window.isMaximized` `window.startDrag` `window.isFrameless` | 窗口管理 |
| **窗口配置** | `window.getConfig` `window.saveState` `window.loadState` | 配置 + 持久化 |
| **对话框** | `dialog.openFile` `dialog.saveFile` `dialog.openFolder` `dialog.message` `dialog.confirm` | 系统对话框 |
| **文件系统** | `fs.readTextFile` `fs.writeTextFile` `fs.exists` `fs.readDir` `fs.mkdir` `fs.remove` `fs.rename` `fs.stat` | 文件操作 |
| **剪贴板** | `clipboard.readText` `clipboard.writeText` | 剪贴板 |
| **Shell** | `shell.open` `shell.execute` | Shell 操作 |
| **应用** | `app.exit` `app.dataDir` | 应用控制 |
| **托盘** | `tray.create` `tray.setTooltip` `tray.remove` | 系统托盘 |
| **环境变量** | `env.get` `env.getAll` | 环境变量 |
| **快捷键** | `hotkey.register` `hotkey.unregister` `hotkey.unregisterAll` | 全局热键 |
| **通知** | `notification.show` | 系统通知 |
| **菜单** | `menu.popup` | 右键菜单 |
| **HTTP** | `http.request` | 原生 HTTP (绕过 CORS) |
| **OS** | `os.platform` `os.arch` `os.version` `os.hostname` `os.username` `os.locale` | 系统信息 |
| **路径** | `path.home` `path.documents` `path.desktop` `path.downloads` `path.appData` `path.localAppData` `path.temp` | 特殊目录 |
| **文件监听** | `watcher.start` `watcher.stop` | 文件系统监听 |
| **DevTools** | `devtools.open` `devtools.close` | 开发者工具 |
| **注册表** | `registry.read` `registry.write` `registry.delete` `registry.exists` | Windows Registry |
| **深度链接** | `protocol.register` `protocol.unregister` | 自定义 URL 协议 |
| **日志** | `log.setFile` `log.write` `log.clear` `log.getPath` | 结构化日志 |

## 事件列表

| 事件 | 数据 | 说明 |
|---|---|---|
| `window.focus` | — | 窗口获得焦点 |
| `window.blur` | — | 窗口失去焦点 |
| `window.maximized` | — | 窗口最大化 |
| `window.minimized` | — | 窗口最小化 |
| `window.restored` | — | 窗口还原 |
| `window.resized` | `{ w, h }` | 窗口大小改变 |
| `window.moved` | `{ x, y }` | 窗口位置改变 |
| `window.closing` | — | 窗口即将关闭 |
| `window.fileDrop` | `{ files, x, y }` | 文件拖放到窗口 |
| `hotkey.triggered` | `{ id }` | 全局快捷键触发 |
| `watcher.changed` | `{ id, action, path }` | 文件变更 |
| `tray.click` | — | 托盘单击 |
| `tray.doubleClick` | — | 托盘双击 |
| `tray.rightClick` | — | 托盘右击 |

## 自定义图标

替换 `native/app.ico` 为你的图标文件，重新 `bun run build` 即可。

推荐包含以下尺寸：16×16, 32×32, 48×48, 256×256。

## 对比

| | 强强 | Electron | Tauri |
|---|---|---|---|
| exe 大小 | **687 KB** (单 exe) | ~120 MB | ~2 MB |
| 内存占用 | ~30 MB | ~150 MB | ~40 MB |
| 编译速度 | ~2s | N/A | ~10s |
| 跨平台 | 仅 Windows | ✓ | ✓ |
| 前端自由度 | 完全自由 | 完全自由 | 完全自由 |
| 原生 API | 80 个 | ~50+ | ~70+ |
| 单 exe 分发 | ✓ | ✗ | ✗ |

## License

MIT
