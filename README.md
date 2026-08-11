<p align="center"><img src="native/app.svg" width="96" alt="QiangQiang logo"></p>
<h1 align="center">强强 (QiangQiang)</h1>
<p align="center"><strong>面向 AI 编程代理的超轻量 Windows 桌面应用框架</strong></p>

<p align="center">
  <a href="https://github.com/kobolingfeng/qiangqiang/actions/workflows/ci.yml"><img src="https://github.com/kobolingfeng/qiangqiang/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/kobolingfeng/qiangqiang?style=flat-square" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Windows-10%20%7C%2011-0078D4?logo=windows&style=flat-square" alt="Windows 10 and 11">
  <img src="https://img.shields.io/badge/Bun-1.3.14-fbf0df?logo=bun&style=flat-square" alt="Bun 1.3.14">
  <img src="https://img.shields.io/badge/C%2B%2B-20-00599C?logo=cplusplus&style=flat-square" alt="C++20">
</p>

<p align="center">
  <a href="README.en.md">English</a> · <strong>中文</strong> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="docs/ARCHITECTURE.md">架构</a> ·
  <a href="docs/ROADMAP.md">路线图</a> ·
  <a href="CONTRIBUTING.zh-CN.md">参与贡献</a>
</p>

强强使用 C++20、Win32、WebView2、Bun 和 TypeScript，让开发者与 AI 编程代理用熟悉的 Web 前端技术构建原生质感的 Windows 应用，同时保持框架代码短小、可审计、易理解。

> 仅 **884KB** 单 exe，**93 个原生命令 + 16 个事件**，无需随应用捆绑独立浏览器或 JavaScript 运行时（使用 Windows 10/11 自带的 WebView2）。

## 为什么对 AI 友好

- **上下文小且边界清晰** — 一个原生实现文件、一个类型化 API 面和固定的生成目录，代理无需遍历庞大运行时。
- **接口可验证** — C++ IPC 处理器与 TypeScript 类型一一对应，`check`、`test`、单 exe 构建都有统一命令。
- **前端自由** — AI 可以使用原生 TypeScript、React、Vue、Svelte 或 Solid，原生能力由稳定 API 提供。
- **代理原生支持** — 仓库内置 `AGENTS.md`、GitHub Copilot 指令、架构文档和路径级编码约束。
- **产物易交付** — HTML、JavaScript、配置和原生壳可打包为一个体积很小的 exe。

> [!IMPORTANT]
> 这是**框架源代码仓库**。开发具体应用时，请将脚手架复制到独立项目目录；AI 编程代理应把 `native/main.cpp`、`src/api.ts` 和 `src/ipc.ts` 视为框架边界，默认只在新项目的应用层工作。只有维护框架本身时才直接修改此仓库。

> [!NOTE]
> 项目目前处于首个正式预览版之前，仅支持 Windows。公共 API 仍可能演进，请关注 [CHANGELOG](CHANGELOG.md) 与 [路线图](docs/ROADMAP.md)。

## 特性

- **极小体积** — 单 exe 884KB（含嵌入 HTML/JS/Config），无需任何外部文件
- **极快编译** — 单文件 C++，增量编译 < 2s
- **完整 API** — 93 个原生命令 + 16 个事件 + 完整 TypeScript 类型
- **真无边框窗口** — Composition 模式 WebView2（和 Wails/Tauri 同级），零像素边框 + DWM 阴影
- **原生窗口动画** — 最小化、最大化、还原、打开、关闭走 Win32/DWM 过渡动画
- **Win11 主题联动** — 自动跟随系统深浅色和强调色，同步 DWM 边框与前端 CSS 变量
- **文件查看器示例** — 默认示例已升级为桌面文件查看器，支持目录浏览、过滤、文本预览和属性面板
- **热重载开发** — `bun run dev` 一键启动，支持 Vite HMR / 内置 Bun 热重载
- **零依赖** — 不需要 Node.js、Electron、Tauri 等
- **单 exe 分发** — `bun run build:single`，pak 打包 + 内存资源拦截，支持 Vite 多文件产物
- **前端自由** — 支持 Vite / React / Vue / Svelte / Solid / 原生 TS，配置化接入
- **仅 Windows** — 专注 Windows 平台，API 直达系统底层

## 快速开始

### 前置要求

- [Bun](https://bun.sh) — 前端构建 + 脚本
- [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) — C++ 编译器（勾选"使用 C++ 的桌面开发"）

### 安装

```bash
bun install
bun run setup    # 下载 WebView2 SDK + JSON 库
bun run check    # TypeScript 类型检查
bun run test     # 自动化测试
```

### 开发

```bash
bun run dev      # 热重载开发模式（F12 打开 DevTools）
```

### 构建

```bash
bun run build            # 编译前端 + 原生壳
bun run build:native     # 仅编译原生壳（改了 main.cpp 时用）
bun run build:frontend   # 仅编译前端
bun run build:single     # 编译单 exe（HTML/JS 嵌入资源段）
```

### 打包

```bash
bun run package  # 生成 release/强强文件查看器-portable.zip
bun run package:single  # 生成 release/强强文件查看器-single.zip（仅包含单 exe）
```

## 内置示例：文件查看器

当前 `src/` 默认实现了一个可直接运行的文件查看器应用，用来展示强强的窗口动画、系统主题联动和文件系统 API：

- 左侧目录文件列表，支持过滤、排序、上一级和刷新
- 中间文本/代码预览，支持常见源码、Markdown、JSON、日志等文本文件
- 右侧属性面板，显示路径、类型、大小、修改时间
- 支持系统对话框打开文件/文件夹、外部打开和资源管理器定位
- 跟随 Windows 11 深浅色与强调色变化

## 使用 Vite / Vue / React

强强默认使用 Bun 打包前端。如果你想用 Vite + Vue/React，只需在 `app.config.json` 中配置：

```json
{
    "dev": {
        "command": "npx vite",
        "port": 5173,
        "waitForPort": true
    },
    "build": {
        "command": "npx vite build"
    }
}
```

3 步接入 Vite + Vue：

```bash
# 1. 初始化 Vue 项目
bun create vite src --template vue-ts
# 2. 在 app.config.json 加上 dev.command 和 build.command
# 3. 开发
bun run dev
```

`dev.command` 和 `build.command` 支持任何命令（Vite、Webpack、Parcel 等）。不配置则走内置 Bun 打包。

## API 总览

### 窗口管理 (17 命令 + 9 事件)

```typescript
import { win } from './api';

await win.setTitle('我的应用');
await win.setSize(1280, 720);
await win.center();
await win.maximize();
await win.setAlwaysOnTop(true);
await win.startDrag();  // 自定义标题栏拖拽
await win.startResize('bottom-right');  // 自定义边角缩放
await win.setBackgroundColor('#1a1a2e');  // 动态切换主题时同步 DWM 边框色
await win.setEffect('mica');  // Windows 11 Mica / Acrylic 特效

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
        "center": true,
        "visible": true,
        "showWhenReady": true,
        "frameless": true,
        "rounded": true,
        "saveWindowState": true,
        "titleBarHeight": 40,
        "borderSize": 6,
        "backgroundColor": "#1a1a2e",
        "followSystemTheme": true,
        "lightBackgroundColor": "#f6f6f9",
        "darkBackgroundColor": "#1a1a2e",
        "singleInstance": true,
        "splash": true
    },
    "dev": {
        "port": 3000,
        "command": "npx vite",
        "waitForPort": true
    },
    "build": {
        "command": "npx vite build",
        "outDir": "dist"
    }
}
```

| 字段 | 说明 |
|---|---|
| `width` / `height` | 窗口内容区尺寸；原生装饰窗口会自动换算标题栏与边框尺寸 |
| `minWidth` / `minHeight` | 最小内容区尺寸；原生装饰窗口会自动换算为外框限制 |
| `center` | 首次打开时居中显示；有持久化窗口状态时优先恢复状态 |
| `visible` | 是否启动后立即显示；设为 `false` 可在前端加载完成后调用 `window.show` |
| `showWhenReady` | 是否等 WebView2 渲染完首帧后再显示窗口（默认 `true`），消除启动时的白屏 / 原生标题栏闪现；设为 `false` 则窗口创建后立即显示 |
| `frameless` | 启用无边框 Composition 模式；设为 `false` 时使用 Windows 原生标题栏和边框 |
| `rounded` | 无边框窗口是否使用 Win11 圆角 + 原生 DWM 投影阴影（默认 `true`）；设为 `false` 用直角 |
| `saveWindowState` | 是否自动保存并恢复窗口位置、尺寸和最大化状态 |
| `borderSize` | 窗口边缘 resize 手柄的 hit-test 宽度（像素） |
| `backgroundColor` | 窗口默认背景色 |
| `followSystemTheme` | 跟随 Windows 主题深浅色和强调色变化 |
| `lightBackgroundColor` / `darkBackgroundColor` | 跟随系统主题时的亮色/暗色窗口背景 |
| `dev.command` | 自定义开发服务器命令（Vite、Webpack 等），不设则用内置 Bun |
| `build.command` | 自定义构建命令，不设则用内置 Bun |
| `window.effect` | 窗口特效：`"none"` `"mica"` `"acrylic"` `"micaAlt"`（Win11） |

## 项目结构

```
├── native/
│   ├── main.cpp        # C++ 壳（WebView2 Composition 模式）
│   ├── app.rc          # 资源文件
│   └── app.ico         # 应用图标（替换此文件自定义图标）
├── src/
│   ├── ipc.ts          # IPC 通信桥
│   ├── api.ts          # 全部 93 个命令的 TypeScript 类型封装
│   ├── main.ts         # 文件查看器示例前端
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

## 全部命令列表 (93 个)

| 分类 | 命令 | 说明 |
|---|---|---|
| **窗口** | `window.setTitle` `window.minimize` `window.maximize` `window.restore` `window.close` `window.show` `window.hide` `window.size` `window.setSize` `window.position` `window.setPosition` `window.center` `window.setAlwaysOnTop` `window.isMaximized` `window.setBackgroundColor` `window.setEffect` `window.setOpacity` `window.setProgress` `window.startDrag` `window.startResize` `window.isFrameless` | 窗口管理 |
| **多窗口** | `window.createChild` `window.closeChild` `window.listChildren` | 子窗口 |
| **窗口配置** | `window.getConfig` `window.saveState` `window.loadState` | 配置 + 持久化 |
| **对话框** | `dialog.openFile` `dialog.saveFile` `dialog.openFolder` `dialog.message` `dialog.confirm` | 系统对话框 |
| **文件系统** | `fs.readTextFile` `fs.readTextRange` `fs.writeTextFile` `fs.exists` `fs.readDir` `fs.mkdir` `fs.remove` `fs.rename` `fs.stat` | 文件操作 |
| **剪贴板** | `clipboard.readText` `clipboard.writeText` | 剪贴板 |
| **Shell** | `shell.open` `shell.execute` `shell.run` | Shell 操作 |
| **应用** | `app.exit` `app.dataDir` `app.exeDir` `app.extractAsset` `app.checkUpdate` `app.downloadUpdate` `app.installUpdate` | 应用控制 |
| **托盘** | `tray.create` `tray.setTooltip` `tray.remove` | 系统托盘 |
| **环境变量** | `env.get` `env.getAll` | 环境变量 |
| **快捷键** | `hotkey.register` `hotkey.unregister` `hotkey.unregisterAll` | 全局热键 |
| **通知** | `notification.show` | 系统通知 |
| **菜单** | `menu.popup` | 右键菜单 |
| **HTTP** | `http.request` | 原生 HTTP (绕过 CORS) |
| **OS** | `os.platform` `os.arch` `os.version` `os.hostname` `os.username` `os.locale` `os.isDarkMode` `os.theme` `os.accentColor` | 系统信息 |
| **路径** | `path.home` `path.documents` `path.desktop` `path.downloads` `path.appData` `path.localAppData` `path.temp` | 特殊目录 |
| **文件监听** | `watcher.start` `watcher.stop` | 文件系统监听 |
| **DevTools** | `devtools.open` | 开发者工具 |
| **注册表** | `registry.read` `registry.write` `registry.delete` `registry.exists` | Windows Registry |
| **深度链接** | `protocol.register` `protocol.unregister` | 自定义 URL 协议 |
| **日志** | `log.setFile` `log.write` `log.clear` `log.getPath` | 结构化日志 |

## 事件列表 (16 个)

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
| `window.childClosed` | `{ id }` | 子窗口关闭 |
| `tray.click` | — | 托盘单击 |
| `tray.doubleClick` | — | 托盘双击 |
| `tray.rightClick` | — | 托盘右击 |
| `os.themeChanged` | `{ dark, accentColor, backgroundColor, foregroundColor }` | 系统主题变化 |

## 安全权限

通过 `permissions` 配置限制前端可调用的 API：

```json
{
    "permissions": {
        "registry.*": false,
        "shell.execute": false,
        "fs.*": true
    }
}
```

支持命名空间通配符（`fs.*` 匹配所有 `fs.xxx` 命令）。未列出的命令默认允许。

## 自动更新

```typescript
import { app } from './api';

const info = await app.checkUpdate('https://example.com/version.json');
if (info.version > currentVersion) {
    await app.downloadUpdate(info.downloadUrl);
    await app.installUpdate(); // 热替换 exe 并重启
}
```

## 多窗口

```typescript
import { win } from './api';

const id = await win.createChild({
    title: '设置',
    width: 500,
    height: 400,
    url: 'https://app.local/settings.html'
});
win.onChildClosed(({ id }) => console.log('关闭:', id));
await win.closeChild(id);
```

## 系统主题 & 窗口控制

```typescript
import { os, win } from './api';

// 检测系统暗色模式
const dark = await os.isDarkMode();

// 读取并监听 Windows 主题/强调色
const theme = await os.theme();
os.onThemeChanged((theme) => {
    document.documentElement.style.setProperty('--accent', theme.accentColor);
    win.setBackgroundColor(theme.backgroundColor);
});

// 窗口透明度 (0.0 ~ 1.0)
await win.setOpacity(0.9);

// 任务栏进度条 (-1 隐藏, 0~1 进度)
await win.setProgress(0.5);
await win.setProgress(-1); // 隐藏

// 执行命令并获取输出
import { shell } from './api';
const { exitCode, stdout, stderr } = await shell.run('git', ['status']);
```

## 标题栏拖拽区域

CSS `app-region` 在原生层是关闭的——开启后 WebView2 会在拖拽区域上方生成进程内非客户区子窗口，挡住无边框窗口缩放用的细边缘 hit zone（且在 CSS `zoom` 下定位会错位），导致顶边和顶角缩放失灵。改为在 JS 里手动转发拖拽，和缩放走同一条路（`window.startDrag()` / `window.startResize()`），两者互不冲突：

```ts
import { win } from './api';

titlebar.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('.titlebar-controls')) return; // 排除按钮等交互元素
    win.startDrag();
});
titlebar.addEventListener('dblclick', async (event) => {
    if ((event.target as HTMLElement).closest('.titlebar-controls')) return;
    if (await win.isMaximized()) await win.restore();
    else await win.maximize();
});
```

默认文件查看器示例（`src/main.ts` 的 `setupWindowChrome`）已经是这个实现，照搬即可。

## 无边框窗口缩放

默认文件查看器示例会在窗口四边和四角铺设不可见 resize hit zone。鼠标移到边缘会显示系统缩放光标，拖动后交给 Win32 原生缩放处理。自定义前端也可以直接调用：

```ts
import { win } from './api';

await win.startResize('bottom-right');
```

## 窗口特效

Windows 11 支持 Mica / Acrylic 材质特效：

```json
{
    "window": {
        "effect": "mica"
    }
}
```

或运行时切换：

```typescript
await win.setEffect('mica');     // Mica 材质
await win.setEffect('acrylic');  // Acrylic 亚克力
await win.setEffect('micaAlt');  // MicaAlt (标签页风格)
await win.setEffect('none');     // 关闭特效
```

> 使用特效时，WebView2 背景自动设为透明。前端 CSS 需要用 `background: transparent` 或半透明色才能看到效果。

## 自定义图标

替换 `native/app.ico` 为你的图标文件，重新 `bun run build` 即可。

推荐包含以下尺寸：16×16, 32×32, 48×48, 256×256。

## 对比

| | 强强 | Wails | Tauri | Electron |
|---|---|---|---|---|
| 单 exe 大小 | **884 KB** | ~9 MB | ~2 MB | ~120 MB |
| 内存占用 | ~30 MB | ~50 MB | ~40 MB | ~150 MB |
| 启动速度 | **~0.5s** | ~1s | ~0.5s | ~2s |
| 编译速度 | ~2s | ~10s | ~10s | N/A |
| 跨平台 | 仅 Windows | ✓ | ✓ | ✓ |
| 前端自由度 | 完全自由 | 完全自由 | 完全自由 | 完全自由 |
| 原生 API | 93 个 | ~30+ | ~70+ | ~50+ |
| 单 exe 分发 | ✓ | ✓ | ✗ | ✗ |
| 运行时开销 | 零（纯 C++） | Go 运行时 ~5MB | Rust 运行时 ~2MB | Chromium |
| 资源加载 | 零拷贝内存映射 | Go embed | include_bytes! | asar |

> 以上数据基于同一个 Vue 3 前端应用（墨线编辑器）的对比测试。

## 示例应用

[`examples/墨线.exe`](examples/) — 一个基于强强构建的 Markdown 编辑器，仅 **884 KB** 单 exe。双击即可运行（需要 Windows 10/11）。

同样的应用使用 Wails 构建单文件需要 **~9 MB**，强强仅需不到 1/10 的体积，同时启动更快、内存占用更少。

## 社区与维护

- 提交 Pull Request 前请阅读[中文贡献指南](CONTRIBUTING.zh-CN.md)。
- 使用问题和应用创意请前往 [GitHub Discussions](https://github.com/kobolingfeng/qiangqiang/discussions)。
- 安全漏洞请按照[安全策略](SECURITY.md)私下报告。
- 深入了解项目请查看[架构](docs/ARCHITECTURE.md)、[路线图](docs/ROADMAP.md)和[变更记录](CHANGELOG.md)。
- 中文交流也欢迎前往 [LinuxDO](https://linux.do)。

## 支持项目

强强由维护者利用业余时间独立开发。代码贡献、Issue、文档完善和赞助都能帮助项目持续发展。

<a href="https://paypal.me/koboling"><img src="https://img.shields.io/badge/PayPal-赞助-blue?logo=paypal&style=flat-square" alt="PayPal 赞助"></a>

<details>
<summary>微信赞赏</summary>

<img src="assets/wechat-sponsor.jpg" width="240" alt="微信赞赏码">
</details>

## 许可证

强强基于 [MIT License](LICENSE) 开源。
