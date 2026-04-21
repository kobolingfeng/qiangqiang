import { win, dialog, fs, clipboard, tray, app } from './api';
import { invoke } from './ipc';

const output = document.getElementById('output')!;
let alwaysOnTop = false;

function log(text: string) {
    output.textContent = text;
}

// ── Frameless titlebar ──────────────────────
(async () => {
    const frameless = await invoke<boolean>('window.isFrameless');
    if (!frameless) return;

    const titlebar = document.getElementById('titlebar')!;
    titlebar.classList.add('active');

    // Drag on titlebar area (excluding buttons)
    titlebar.addEventListener('mousedown', (e) => {
        if ((e.target as HTMLElement).closest('.titlebar-controls')) return;
        win.startDrag();
    });

    document.getElementById('tb-min')!.addEventListener('click', () => win.minimize());
    document.getElementById('tb-max')!.addEventListener('click', async () => {
        const maximized = await win.isMaximized();
        if (maximized) await win.restore();
        else await win.maximize();
    });
    document.getElementById('tb-close')!.addEventListener('click', () => win.close());

    // ── Window edge resize (Tauri/Wails pattern) ──
    // Detect mouse near window edge → set cursor class + invoke native resize
    // on mousedown. Works with any window — WebView2 fills client area.
    type Edge = 'left'|'right'|'top'|'bottom'|'top-left'|'top-right'|'bottom-left'|'bottom-right';
    const EDGE = 6;
    const classMap: Record<Edge, string> = {
        'left': 'rz-ew', 'right': 'rz-ew',
        'top': 'rz-ns', 'bottom': 'rz-ns',
        'top-left': 'rz-nwse', 'bottom-right': 'rz-nwse',
        'top-right': 'rz-nesw', 'bottom-left': 'rz-nesw',
    };
    let curEdge: Edge | null = null;

    const detectEdge = (e: MouseEvent): Edge | null => {
        const w = window.innerWidth, h = window.innerHeight;
        const L = e.clientX < EDGE, R = e.clientX >= w - EDGE;
        const T = e.clientY < EDGE, B = e.clientY >= h - EDGE;
        if (T && L) return 'top-left';
        if (T && R) return 'top-right';
        if (B && L) return 'bottom-left';
        if (B && R) return 'bottom-right';
        if (L) return 'left';
        if (R) return 'right';
        if (T) return 'top';
        if (B) return 'bottom';
        return null;
    };

    document.addEventListener('mousemove', (e) => {
        const edge = detectEdge(e);
        if (edge === curEdge) return;
        if (curEdge) document.body.classList.remove(classMap[curEdge]);
        curEdge = edge;
        if (edge) document.body.classList.add(classMap[edge]);
    });

    document.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const edge = detectEdge(e);
        if (edge) {
            e.preventDefault();
            e.stopImmediatePropagation();
            win.startResize(edge);
        }
    }, true); // capture so we beat titlebar drag and other handlers
})();

// ── Window ──────────────────────────────────
document.getElementById('btn-title')!.addEventListener('click', async () => {
    const title = window.prompt('新标题:');
    if (!title) return;
    await win.setTitle(title);
    // Also update custom titlebar text
    const tb = document.querySelector('.titlebar-title');
    if (tb) tb.textContent = title;
    log(`标题 → ${title}`);
});

document.getElementById('btn-size')!.addEventListener('click', async () => {
    const { w, h } = await win.size();
    const pos = await win.position();
    log(`大小: ${w}×${h}  位置: (${pos.x}, ${pos.y})`);
});

document.getElementById('btn-center')!.addEventListener('click', async () => {
    await win.center();
    log('窗口已居中');
});

document.getElementById('btn-top')!.addEventListener('click', async () => {
    alwaysOnTop = !alwaysOnTop;
    await win.setAlwaysOnTop(alwaysOnTop);
    log(`置顶: ${alwaysOnTop ? 'ON' : 'OFF'}`);
});

document.getElementById('btn-min')!.addEventListener('click', () => win.minimize());
document.getElementById('btn-max')!.addEventListener('click', () => win.maximize());

// ── Dialogs ─────────────────────────────────
document.getElementById('btn-open')!.addEventListener('click', async () => {
    const path = await dialog.openFile({
        filters: [
            { name: '文本文件', extensions: ['txt', 'md', 'json', 'ts', 'js'] },
            { name: '所有文件', extensions: ['*'] },
        ]
    });
    if (path && typeof path === 'string') {
        const content = await fs.readTextFile(path);
        const preview = content.length > 200 ? content.slice(0, 200) + '...' : content;
        log(`📄 ${path}\n${preview}`);
    } else {
        log('已取消');
    }
});

document.getElementById('btn-save')!.addEventListener('click', async () => {
    const path = await dialog.saveFile({
        filters: [{ name: '文本文件', extensions: ['txt'] }],
        defaultName: 'test.txt',
    });
    if (path) {
        await fs.writeTextFile(path, '强强 says hello!');
        log(`已保存 → ${path}`);
    } else {
        log('已取消');
    }
});

document.getElementById('btn-folder')!.addEventListener('click', async () => {
    const path = await dialog.openFolder();
    if (path && typeof path === 'string') {
        const entries = await fs.readDir(path);
        const list = entries.slice(0, 20).map(e => `${e.isDir ? '📁' : '📄'} ${e.name}`).join('\n');
        log(`📂 ${path}\n${list}${entries.length > 20 ? `\n... +${entries.length - 20} more` : ''}`);
    } else {
        log('已取消');
    }
});

document.getElementById('btn-msg')!.addEventListener('click', async () => {
    await dialog.message('强强', '这是一个原生 MessageBox！', 'info');
    log('消息框已关闭');
});

document.getElementById('btn-confirm')!.addEventListener('click', async () => {
    const yes = await dialog.confirm('强强', '你确定吗？');
    log(`确认: ${yes ? '是' : '否'}`);
});

// ── System ──────────────────────────────────
document.getElementById('btn-clip-read')!.addEventListener('click', async () => {
    const text = await clipboard.readText();
    log(`📋 ${text ?? '(空)'}`);
});

document.getElementById('btn-clip-write')!.addEventListener('click', async () => {
    await clipboard.writeText('强强 clipboard test @ ' + new Date().toLocaleTimeString());
    log('已写入剪贴板');
});

document.getElementById('btn-tray')!.addEventListener('click', async () => {
    await tray.create('强强');
    tray.onClick(() => log('托盘: 单击'));
    tray.onDoubleClick(() => log('托盘: 双击 (窗口已恢复)'));
    tray.onRightClick(() => log('托盘: 右键'));
    log('托盘已创建 (关闭窗口将最小化到托盘)');
});

document.getElementById('btn-tray-rm')!.addEventListener('click', async () => {
    await tray.remove();
    log('托盘已移除');
});

document.getElementById('btn-datadir')!.addEventListener('click', async () => {
    const dir = await app.dataDir();
    log(`数据目录: ${dir}`);
});
