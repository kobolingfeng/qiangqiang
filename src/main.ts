import {
    dialog,
    fs,
    os,
    path as nativePath,
    shell,
    win,
    type DirEntry,
    type FileStat,
    type SystemTheme,
} from './api';
import { invoke } from './ipc';

type EntryRecord = DirEntry & { path: string };
type SortMode = 'name' | 'kind';

const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;
const MAX_PREVIEW_CHARS = 500_000;
const TEXT_EXTENSIONS = new Set([
    'bat', 'c', 'cc', 'cmd', 'cpp', 'cs', 'css', 'csv', 'go', 'h', 'hpp',
    'html', 'ini', 'java', 'js', 'json', 'jsx', 'log', 'md', 'ps1', 'py',
    'rs', 'sh', 'sql', 'svg', 'toml', 'ts', 'tsx', 'txt', 'xml', 'yaml', 'yml',
]);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const ui = {
    titlebar: $('titlebar'),
    address: $('address') as HTMLInputElement,
    fileList: $('file-list'),
    filter: $('filter') as HTMLInputElement,
    sort: $('sort') as HTMLSelectElement,
    preview: $('preview'),
    previewTitle: $('preview-title'),
    previewSearch: $('preview-search') as HTMLInputElement,
    details: $('details') as HTMLDListElement,
    statusLeft: $('status-left'),
    statusRight: $('status-right'),
    themePill: $('theme-pill'),
    up: $('btn-up') as HTMLButtonElement,
    home: $('btn-home') as HTMLButtonElement,
    refresh: $('btn-refresh') as HTMLButtonElement,
    openFolder: $('btn-open-folder') as HTMLButtonElement,
    openFile: $('btn-open-file') as HTMLButtonElement,
    openExternal: $('btn-open-external') as HTMLButtonElement,
    reveal: $('btn-reveal') as HTMLButtonElement,
};

let currentFolder = '';
let currentFile = '';
let selectedPath = '';
let entries: EntryRecord[] = [];
let currentText = '';

function hexToRgb(hex: string): [number, number, number] {
    const value = hex.replace('#', '');
    if (value.length !== 6) return [0, 120, 212];
    return [
        Number.parseInt(value.slice(0, 2), 16),
        Number.parseInt(value.slice(2, 4), 16),
        Number.parseInt(value.slice(4, 6), 16),
    ];
}

function mix(a: string, b: string, amount: number): string {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    const mixed = ca.map((v, i) => Math.round(v + (cb[i] - v) * amount));
    return `#${mixed.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function applySystemTheme(theme: SystemTheme) {
    const root = document.documentElement;
    const bg = theme.backgroundColor;
    const fg = theme.foregroundColor;
    const accent = theme.accentColor;
    const toward = theme.dark ? '#ffffff' : '#000000';
    const away = theme.dark ? '#000000' : '#ffffff';

    root.style.setProperty('--bg', bg);
    root.style.setProperty('--text', fg);
    root.style.setProperty('--titlebar-bg', mix(bg, away, theme.dark ? 0.12 : 0.03));
    root.style.setProperty('--surface', mix(bg, toward, theme.dark ? 0.055 : 0.025));
    root.style.setProperty('--surface-2', mix(bg, toward, theme.dark ? 0.09 : 0.04));
    root.style.setProperty('--surface-hover', mix(accent, bg, theme.dark ? 0.68 : 0.84));
    root.style.setProperty('--preview-bg', mix(bg, away, theme.dark ? 0.18 : 0.035));
    root.style.setProperty('--border', mix(accent, bg, theme.dark ? 0.58 : 0.72));
    root.style.setProperty('--muted', mix(fg, bg, 0.42));
    root.style.setProperty('--subtle', mix(fg, bg, 0.62));
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-text', theme.dark ? '#ffffff' : '#ffffff');
    root.style.setProperty('--code-text', theme.dark ? mix(accent, '#ffffff', 0.72) : mix(accent, '#000000', 0.28));
    ui.themePill.textContent = `${theme.dark ? 'Dark' : 'Light'} ${accent}`;
    void win.setBackgroundColor(bg).catch(() => {});
}

function setStatus(left: string, right = `${entries.length} 项`) {
    ui.statusLeft.textContent = left;
    ui.statusRight.textContent = right;
}

function extensionOf(filePath: string): string {
    const name = baseName(filePath);
    const idx = name.lastIndexOf('.');
    return idx > 0 ? name.slice(idx + 1).toLowerCase() : '';
}

function baseName(filePath: string): string {
    const clean = trimSeparators(filePath);
    const idx = Math.max(clean.lastIndexOf('\\'), clean.lastIndexOf('/'));
    return idx >= 0 ? clean.slice(idx + 1) : clean;
}

function trimSeparators(filePath: string): string {
    if (/^[A-Za-z]:[\\/]+$/.test(filePath)) return filePath.slice(0, 3);
    return filePath.replace(/[\\/]+$/, '');
}

function dirName(filePath: string): string {
    const clean = trimSeparators(filePath);
    if (/^[A-Za-z]:[\\/]?$/.test(clean)) return clean.endsWith('\\') ? clean : `${clean}\\`;
    const idx = Math.max(clean.lastIndexOf('\\'), clean.lastIndexOf('/'));
    if (idx < 0) return '';
    if (idx === 2 && clean[1] === ':') return clean.slice(0, 3);
    return clean.slice(0, idx);
}

function joinPath(folder: string, name: string): string {
    return folder.endsWith('\\') || folder.endsWith('/') ? `${folder}${name}` : `${folder}\\${name}`;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = bytes / 1024;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit++;
    }
    return `${size >= 10 ? size.toFixed(1) : size.toFixed(2)} ${units[unit]}`;
}

function formatTime(seconds: number): string {
    if (!seconds) return '-';
    return new Date(seconds * 1000).toLocaleString();
}

function kindLabel(entry: Pick<EntryRecord, 'isDir' | 'name'>): string {
    if (entry.isDir) return '文件夹';
    const ext = extensionOf(entry.name);
    return ext ? `${ext.toUpperCase()} 文件` : '文件';
}

function badgeLabel(entry: Pick<EntryRecord, 'isDir' | 'name'>): string {
    if (entry.isDir) return 'DIR';
    const ext = extensionOf(entry.name);
    return (ext || 'FILE').slice(0, 4).toUpperCase();
}

function isTextFile(filePath: string, stat: FileStat): boolean {
    if (stat.size > MAX_PREVIEW_BYTES) return false;
    const ext = extensionOf(filePath);
    return TEXT_EXTENSIONS.has(ext) || (!ext && stat.size <= 64 * 1024);
}

function sortedEntries(): EntryRecord[] {
    const query = ui.filter.value.trim().toLowerCase();
    const sort = ui.sort.value as SortMode;
    const filtered = entries.filter(entry => entry.name.toLowerCase().includes(query));
    return filtered.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        if (sort === 'kind') {
            const kind = kindLabel(a).localeCompare(kindLabel(b), 'zh-CN');
            if (kind !== 0) return kind;
        }
        return a.name.localeCompare(b.name, 'zh-CN', { numeric: true, sensitivity: 'base' });
    });
}

function setDetails(rows: Array<[string, string]>) {
    ui.details.replaceChildren();
    for (const [key, value] of rows) {
        const item = document.createElement('div');
        item.className = 'kv';
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = key;
        dd.textContent = value;
        item.append(dt, dd);
        ui.details.append(item);
    }
}

function updateActions() {
    const target = currentFile || currentFolder;
    ui.up.disabled = !currentFolder || /^[A-Za-z]:[\\/]?$/.test(trimSeparators(currentFolder));
    ui.refresh.disabled = !currentFolder;
    ui.openExternal.disabled = !target;
    ui.reveal.disabled = !target;
}

function renderList() {
    ui.fileList.replaceChildren();
    for (const entry of sortedEntries()) {
        const row = document.createElement('button');
        row.className = `file-row${entry.path === selectedPath ? ' selected' : ''}`;
        row.title = entry.path;

        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = badgeLabel(entry);

        const text = document.createElement('span');
        const name = document.createElement('span');
        const kind = document.createElement('span');
        name.className = 'file-name';
        kind.className = 'file-kind';
        name.textContent = entry.name;
        kind.textContent = kindLabel(entry);
        text.append(name, kind);

        row.append(badge, text);
        row.addEventListener('click', () => void openPath(entry.path));
        ui.fileList.append(row);
    }
    updateActions();
}

function renderFolderPreview(folderPath: string) {
    currentText = '';
    ui.previewTitle.textContent = baseName(folderPath) || folderPath;
    const dirs = entries.filter(entry => entry.isDir).length;
    const files = entries.filter(entry => entry.isFile).length;
    ui.preview.replaceChildren();
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = `${dirs} 个文件夹，${files} 个文件`;
    ui.preview.append(empty);
}

function renderUnsupported(filePath: string, stat: FileStat) {
    currentText = '';
    ui.previewTitle.textContent = baseName(filePath);
    ui.preview.replaceChildren();
    const box = document.createElement('div');
    box.className = 'unsupported';
    const strong = document.createElement('strong');
    strong.textContent = '无法内置预览';
    const text = document.createElement('span');
    text.textContent = `${kindLabel({ isDir: false, name: filePath })}，${formatBytes(stat.size)}`;
    box.append(strong, text);
    ui.preview.append(box);
}

function renderError(message: string) {
    currentText = '';
    ui.preview.replaceChildren();
    const box = document.createElement('div');
    box.className = 'error';
    const strong = document.createElement('strong');
    strong.textContent = '加载失败';
    const text = document.createElement('span');
    text.textContent = message;
    box.append(strong, text);
    ui.preview.append(box);
}

function renderText(filePath: string, text: string, stat: FileStat) {
    currentText = text;
    ui.previewTitle.textContent = baseName(filePath);
    const truncated = text.length > MAX_PREVIEW_CHARS;
    const shown = truncated
        ? `${text.slice(0, MAX_PREVIEW_CHARS)}\n\n--- 已截断，仅显示前 ${formatBytes(MAX_PREVIEW_CHARS)} 字符 ---`
        : text;

    ui.preview.replaceChildren();
    const pre = document.createElement('pre');
    pre.className = 'code';
    pre.textContent = shown;
    ui.preview.append(pre);

    const lines = text.length ? text.split(/\r\n|\r|\n/).length : 0;
    setStatus(`已预览 ${baseName(filePath)}`, `${formatBytes(stat.size)} · ${lines} 行`);
    updateSearchStatus();
}

function updateSearchStatus() {
    const query = ui.previewSearch.value.trim();
    if (!query || !currentText) return;
    const count = currentText.toLowerCase().split(query.toLowerCase()).length - 1;
    setStatus(count ? `找到 ${count} 处匹配` : '没有匹配项');
}

async function showDetails(targetPath: string, stat: FileStat) {
    setDetails([
        ['名称', baseName(targetPath) || targetPath],
        ['路径', targetPath],
        ['类型', stat.isDir ? '文件夹' : kindLabel({ isDir: false, name: targetPath })],
        ['大小', stat.isDir ? '-' : formatBytes(stat.size)],
        ['修改时间', formatTime(stat.modified)],
    ]);
}

async function loadFolder(folderPath: string) {
    setStatus('正在读取目录...');
    currentFolder = trimSeparators(folderPath);
    currentFile = '';
    selectedPath = currentFolder;
    ui.address.value = currentFolder;
    try {
        const list = await fs.readDir(currentFolder);
        entries = list.map(entry => ({ ...entry, path: joinPath(currentFolder, entry.name) }));
        renderList();
        renderFolderPreview(currentFolder);
        const stat = await fs.stat(currentFolder);
        await showDetails(currentFolder, stat);
        setStatus(`已打开 ${baseName(currentFolder) || currentFolder}`, `${entries.length} 项`);
        void win.setTitle(`强强文件查看器 - ${baseName(currentFolder) || currentFolder}`);
    } catch (error) {
        renderError(error instanceof Error ? error.message : String(error));
        setStatus('目录读取失败');
    } finally {
        updateActions();
    }
}

async function loadFile(filePath: string, syncFolder = true) {
    setStatus('正在读取文件...');
    const parent = dirName(filePath);
    if (syncFolder && parent && parent !== currentFolder) {
        currentFolder = parent;
        try {
            const list = await fs.readDir(currentFolder);
            entries = list.map(entry => ({ ...entry, path: joinPath(currentFolder, entry.name) }));
        } catch {
            entries = [];
        }
    }

    currentFile = filePath;
    selectedPath = filePath;
    ui.address.value = filePath;
    renderList();

    try {
        const stat = await fs.stat(filePath);
        await showDetails(filePath, stat);
        if (!isTextFile(filePath, stat)) {
            renderUnsupported(filePath, stat);
            setStatus(`已选择 ${baseName(filePath)}`, formatBytes(stat.size));
            return;
        }

        const text = await fs.readTextFile(filePath);
        renderText(filePath, text.replace(/\u0000/g, '\uFFFD'), stat);
        void win.setTitle(`强强文件查看器 - ${baseName(filePath)}`);
    } catch (error) {
        renderError(error instanceof Error ? error.message : String(error));
        setStatus('文件读取失败');
    } finally {
        updateActions();
    }
}

async function openPath(rawPath: string) {
    const target = rawPath.trim().replace(/^"(.*)"$/, '$1');
    if (!target) return;
    try {
        const stat = await fs.stat(target);
        if (stat.isDir) await loadFolder(target);
        else await loadFile(target);
    } catch (error) {
        renderError(error instanceof Error ? error.message : String(error));
        setStatus('路径不可用');
    }
}

async function chooseFolder() {
    const folder = await dialog.openFolder();
    if (folder) await loadFolder(folder);
}

async function chooseFile() {
    const file = await dialog.openFile({
        filters: [
            { name: '文本与代码', extensions: [...TEXT_EXTENSIONS] },
            { name: '所有文件', extensions: ['*'] },
        ],
    });
    if (typeof file === 'string') await loadFile(file);
}

async function openParent() {
    const base = currentFile ? dirName(currentFile) : currentFolder;
    const parent = dirName(base);
    if (parent && parent !== base) await loadFolder(parent);
}

async function openHome() {
    try {
        await loadFolder(await nativePath.home());
    } catch (error) {
        renderError(error instanceof Error ? error.message : String(error));
    }
}

function bindControls() {
    ui.openFolder.addEventListener('click', () => void chooseFolder());
    ui.openFile.addEventListener('click', () => void chooseFile());
    ui.home.addEventListener('click', () => void openHome());
    ui.up.addEventListener('click', () => void openParent());
    ui.refresh.addEventListener('click', () => currentFolder && void loadFolder(currentFolder));
    ui.filter.addEventListener('input', renderList);
    ui.sort.addEventListener('change', renderList);
    ui.previewSearch.addEventListener('input', updateSearchStatus);
    ui.address.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') void openPath(ui.address.value);
    });
    ui.openExternal.addEventListener('click', () => {
        const target = currentFile || currentFolder;
        if (target) void shell.open(target);
    });
    ui.reveal.addEventListener('click', () => {
        if (currentFile) void shell.execute('explorer.exe', [`/select,${currentFile}`]);
        else if (currentFolder) void shell.open(currentFolder);
    });
}

async function setupWindowChrome() {
    try {
        const frameless = await invoke<boolean>('window.isFrameless');
        if (!frameless) return;

        ui.titlebar.classList.add('active');
        ui.titlebar.addEventListener('mousedown', (event) => {
            if ((event.target as HTMLElement).closest('.titlebar-controls')) return;
            win.startDrag();
        });

        $('tb-min').addEventListener('click', () => win.minimize());
        $('tb-max').addEventListener('click', async () => {
            if (await win.isMaximized()) await win.restore();
            else await win.maximize();
        });
        $('tb-close').addEventListener('click', () => win.close());

        type Edge = 'left'|'right'|'top'|'bottom'|'top-left'|'top-right'|'bottom-left'|'bottom-right';
        const edgeSize = 6;
        const classMap: Record<Edge, string> = {
            left: 'rz-ew',
            right: 'rz-ew',
            top: 'rz-ns',
            bottom: 'rz-ns',
            'top-left': 'rz-nwse',
            'bottom-right': 'rz-nwse',
            'top-right': 'rz-nesw',
            'bottom-left': 'rz-nesw',
        };
        let currentEdge: Edge | null = null;

        const detectEdge = (event: MouseEvent): Edge | null => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            const left = event.clientX < edgeSize;
            const right = event.clientX >= w - edgeSize;
            const top = event.clientY < edgeSize;
            const bottom = event.clientY >= h - edgeSize;
            if (top && left) return 'top-left';
            if (top && right) return 'top-right';
            if (bottom && left) return 'bottom-left';
            if (bottom && right) return 'bottom-right';
            if (left) return 'left';
            if (right) return 'right';
            if (top) return 'top';
            if (bottom) return 'bottom';
            return null;
        };

        document.addEventListener('mousemove', (event) => {
            const edge = detectEdge(event);
            if (edge === currentEdge) return;
            if (currentEdge) document.body.classList.remove(classMap[currentEdge]);
            currentEdge = edge;
            if (edge) document.body.classList.add(classMap[edge]);
        });

        document.addEventListener('mousedown', (event) => {
            if (event.button !== 0) return;
            const edge = detectEdge(event);
            if (edge) {
                event.preventDefault();
                event.stopImmediatePropagation();
                win.startResize(edge);
            }
        }, true);
    } catch {}
}

async function boot() {
    bindControls();
    updateActions();
    void os.theme().then(applySystemTheme).catch(() => {});
    os.onThemeChanged(applySystemTheme);
    await setupWindowChrome();

    try {
        await loadFolder(await nativePath.documents());
    } catch {
        setStatus('选择一个文件夹开始');
    }
}

void boot();
