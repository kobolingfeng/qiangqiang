// src/api.ts — Typed wrappers for all native commands
import { invoke, on } from './ipc';

// ── Types ─────────────────────────────────────

export interface FileFilter {
    name: string;
    extensions: string[];
}

export interface DirEntry {
    name: string;
    isDir: boolean;
    isFile: boolean;
}

export interface FileStat {
    size: number;
    modified: number;
    isDir: boolean;
    isFile: boolean;
}

export interface MenuItem {
    label: string;
    disabled?: boolean;
    checked?: boolean;
}

export interface HttpResponse {
    status: number;
    headers: string;
    body: string;
}

// ── Window ────────────────────────────────────

export const win = {
    setTitle:       (title: string) => invoke<boolean>('window.setTitle', { title }),
    minimize:       () => invoke<boolean>('window.minimize'),
    maximize:       () => invoke<boolean>('window.maximize'),
    restore:        () => invoke<boolean>('window.restore'),
    close:          () => invoke<boolean>('window.close'),
    show:           () => invoke<boolean>('window.show'),
    hide:           () => invoke<boolean>('window.hide'),
    size:           () => invoke<{ w: number; h: number }>('window.size'),
    setSize:        (w: number, h: number) => invoke<boolean>('window.setSize', { w, h }),
    position:       () => invoke<{ x: number; y: number }>('window.position'),
    setPosition:    (x: number, y: number) => invoke<boolean>('window.setPosition', { x, y }),
    center:         () => invoke<boolean>('window.center'),
    setAlwaysOnTop: (top: boolean) => invoke<boolean>('window.setAlwaysOnTop', { top }),
    isMaximized:    () => invoke<boolean>('window.isMaximized'),
    startDrag:      () => invoke<boolean>('window.startDrag'),
    getConfig:      () => invoke<any>('window.getConfig'),
    isFrameless:    () => invoke<boolean>('window.isFrameless'),
    // Events
    onFocus:     (h: () => void) => on('window.focus', h),
    onBlur:      (h: () => void) => on('window.blur', h),
    onMaximized: (h: () => void) => on('window.maximized', h),
    onMinimized: (h: () => void) => on('window.minimized', h),
    onRestored:  (h: () => void) => on('window.restored', h),
    onResized:   (h: (data: { w: number; h: number }) => void) => on('window.resized', h),
    onMoved:     (h: (data: { x: number; y: number }) => void) => on('window.moved', h),
    onClosing:   (h: () => void) => on('window.closing', h),
    onFileDrop:  (h: (data: { files: string[]; x: number; y: number }) => void) => on('window.fileDrop', h),
};

// ── Dialogs ───────────────────────────────────

export const dialog = {
    openFile: (opts?: { filters?: FileFilter[]; multiple?: boolean }) =>
        invoke<string | string[] | null>('dialog.openFile', opts ?? {}),
    saveFile: (opts?: { filters?: FileFilter[]; defaultName?: string }) =>
        invoke<string | null>('dialog.saveFile', opts ?? {}),
    openFolder: () =>
        invoke<string | null>('dialog.openFolder'),
    message: (title: string, message: string, type: 'info' | 'warning' | 'error' = 'info') =>
        invoke<boolean>('dialog.message', { title, message, type }),
    confirm: (title: string, message: string) =>
        invoke<boolean>('dialog.confirm', { title, message }),
};

// ── File system ───────────────────────────────

export const fs = {
    readTextFile:  (path: string) => invoke<string>('fs.readTextFile', { path }),
    writeTextFile: (path: string, content: string) => invoke<boolean>('fs.writeTextFile', { path, content }),
    exists:        (path: string) => invoke<boolean>('fs.exists', { path }),
    readDir:       (path: string) => invoke<DirEntry[]>('fs.readDir', { path }),
    mkdir:         (path: string) => invoke<boolean>('fs.mkdir', { path }),
    remove:        (path: string) => invoke<boolean>('fs.remove', { path }),
    rename:        (from: string, to: string) => invoke<boolean>('fs.rename', { from, to }),
    stat:          (path: string) => invoke<FileStat>('fs.stat', { path }),
};

// ── Clipboard ─────────────────────────────────

export const clipboard = {
    readText:  () => invoke<string | null>('clipboard.readText'),
    writeText: (text: string) => invoke<boolean>('clipboard.writeText', { text }),
};

// ── Shell ─────────────────────────────────────

export const shell = {
    open:    (url: string) => invoke<boolean>('shell.open', { url }),
    execute: (program: string, args?: string[]) => invoke<boolean>('shell.execute', { program, args: args ?? [] }),
};

// ── App ───────────────────────────────────────

export const app = {
    exit:    (code = 0) => invoke<boolean>('app.exit', { code }),
    dataDir: () => invoke<string>('app.dataDir'),
};

// ── Tray ──────────────────────────────────────

export const tray = {
    create:        (tooltip = 'App') => invoke<boolean>('tray.create', { tooltip }),
    setTooltip:    (tooltip: string) => invoke<boolean>('tray.setTooltip', { tooltip }),
    remove:        () => invoke<boolean>('tray.remove'),
    onClick:       (handler: () => void) => on('tray.click', handler),
    onDoubleClick: (handler: () => void) => on('tray.doubleClick', handler),
    onRightClick:  (handler: () => void) => on('tray.rightClick', handler),
};

// ── Environment ───────────────────────────────

export const env = {
    get:    (name: string) => invoke<string | null>('env.get', { name }),
    getAll: () => invoke<Record<string, string>>('env.getAll'),
};

// ── Global Hotkeys ────────────────────────────
// modifiers: MOD_ALT=1, MOD_CONTROL=2, MOD_SHIFT=4, MOD_WIN=8
// key: virtual key code (e.g., 0x41='A', 0x70=F1)

export const hotkey = {
    register:      (id: number, modifiers: number, key: number) =>
        invoke<boolean>('hotkey.register', { id, modifiers, key }),
    unregister:    (id: number) => invoke<boolean>('hotkey.unregister', { id }),
    unregisterAll: () => invoke<boolean>('hotkey.unregisterAll'),
    onTriggered:   (handler: (data: { id: number }) => void) => on('hotkey.triggered', handler),
};

// Modifier constants
export const MOD = { ALT: 1, CONTROL: 2, SHIFT: 4, WIN: 8 } as const;

// Common virtual key codes
export const VK = {
    A: 0x41, B: 0x42, C: 0x43, D: 0x44, E: 0x45, F: 0x46, G: 0x47, H: 0x48,
    I: 0x49, J: 0x4A, K: 0x4B, L: 0x4C, M: 0x4D, N: 0x4E, O: 0x4F, P: 0x50,
    Q: 0x51, R: 0x52, S: 0x53, T: 0x54, U: 0x55, V: 0x56, W: 0x57, X: 0x58,
    Y: 0x59, Z: 0x5A,
    F1: 0x70, F2: 0x71, F3: 0x72, F4: 0x73, F5: 0x74, F6: 0x75,
    F7: 0x76, F8: 0x77, F9: 0x78, F10: 0x79, F11: 0x7A, F12: 0x7B,
    SPACE: 0x20, ENTER: 0x0D, ESC: 0x1B, TAB: 0x09,
} as const;

// ── Notifications ─────────────────────────────

export const notification = {
    show: (title: string, body: string) =>
        invoke<boolean>('notification.show', { title, body }),
};

// ── Context Menu ──────────────────────────────

export const menu = {
    /** Returns 0-based index of selected item, or null if cancelled. Use "-" for separator. */
    popup: (items: (MenuItem | '-')[]) =>
        invoke<number | null>('menu.popup', { items }),
};

// ── HTTP Client (bypasses CORS) ───────────────

export const http = {
    request: (opts: {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: string;
    }) => invoke<HttpResponse>('http.request', opts),
    get:  (url: string, headers?: Record<string, string>) =>
        invoke<HttpResponse>('http.request', { url, method: 'GET', headers }),
    post: (url: string, body: string, headers?: Record<string, string>) =>
        invoke<HttpResponse>('http.request', { url, method: 'POST', body, headers }),
};

// ── OS Info ───────────────────────────────────

export const os = {
    platform: () => invoke<string>('os.platform'),
    arch:     () => invoke<string>('os.arch'),
    version:  () => invoke<string>('os.version'),
    hostname: () => invoke<string>('os.hostname'),
    username: () => invoke<string>('os.username'),
    locale:   () => invoke<string>('os.locale'),
};

// ── Special Paths ─────────────────────────────

export const path = {
    home:         () => invoke<string>('path.home'),
    documents:    () => invoke<string>('path.documents'),
    desktop:      () => invoke<string>('path.desktop'),
    downloads:    () => invoke<string>('path.downloads'),
    appData:      () => invoke<string>('path.appData'),
    localAppData: () => invoke<string>('path.localAppData'),
    temp:         () => invoke<string>('path.temp'),
};

// ── File Watcher ──────────────────────────────

export const watcher = {
    /** Start watching a directory. Returns a watcher ID. */
    start:     (path: string) => invoke<number>('watcher.start', { path }),
    /** Stop a watcher by ID. */
    stop:      (id: number) => invoke<boolean>('watcher.stop', { id }),
    /** Listen for file change events. */
    onChange:  (handler: (data: { id: number; action: string; path: string }) => void) =>
        on('watcher.changed', handler),
};

// ── DevTools ──────────────────────────────────

export const devtools = {
    open: () => invoke<boolean>('devtools.open'),
};
