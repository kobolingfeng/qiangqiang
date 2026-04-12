// scripts/dev.ts — Dev mode: build frontend + serve + launch native shell
import { existsSync, mkdirSync, watch } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dir, '..');
const DIST = join(ROOT, 'dist');
const SRC  = join(ROOT, 'src');

// ── Check native exe ──────────────────────────────────
const exePath = join(DIST, 'app.exe');
if (!existsSync(exePath)) {
    console.log('Native shell not found. Running full build first...\n');
    const r = Bun.spawnSync(['bun', 'run', 'build'], { cwd: ROOT, stdout: 'inherit', stderr: 'inherit' });
    if (r.exitCode !== 0) {
        console.error('\n❌ Build failed. Fix errors and try again.');
        process.exit(1);
    }
    console.log('');
}

// ── Build frontend ────────────────────────────────────
let buildCount = 0;

async function buildFrontend() {
    mkdirSync(DIST, { recursive: true });
    const result = await Bun.build({
        entrypoints: [join(SRC, 'main.ts')],
        outdir: DIST,
        target: 'browser',
    });
    if (!result.success) {
        console.error('Frontend build error:', result.logs);
        return false;
    }

    // Copy HTML with .ts → .js and inject live-reload script
    let html = await Bun.file(join(SRC, 'index.html')).text();
    html = html.replace('./main.ts', './main.js');
    html = html.replace('</body>', `<script>
let _rc = "0";
setInterval(async () => {
    try {
        const r = await fetch('/__reload').then(r => r.text());
        if (_rc !== "0" && r !== _rc) location.reload();
        _rc = r;
    } catch {}
}, 500);
</script>\n</body>`);
    await Bun.write(join(DIST, 'index.html'), html);

    // Copy config to dist for native shell
    const cfgSrc = join(ROOT, 'app.config.json');
    if (existsSync(cfgSrc))
        await Bun.write(join(DIST, 'app.config.json'), Bun.file(cfgSrc));

    buildCount++;
    return true;
}

await buildFrontend();
console.log('✓ Frontend built');

// ── Watch for changes ─────────────────────────────────
let rebuilding = false;
watch(SRC, { recursive: true }, async (_event, filename) => {
    if (rebuilding) return;
    rebuilding = true;
    console.log(`⟳ ${filename} changed, rebuilding...`);
    if (await buildFrontend()) {
        console.log('✓ Rebuilt');
    }
    rebuilding = false;
});

// ── Read dev port from config ─────────────────────────
let PORT = 3000;
try {
    const cfg = await Bun.file(join(ROOT, 'app.config.json')).json();
    PORT = cfg?.dev?.port ?? 3000;
} catch {}

const server = Bun.serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);

        // Live-reload endpoint
        if (url.pathname === '/__reload') {
            return new Response(String(buildCount));
        }

        let path = url.pathname;
        if (path === '/') path = '/index.html';

        const file = Bun.file(join(DIST, path));
        if (await file.exists()) {
            return new Response(file);
        }
        return new Response('Not Found', { status: 404 });
    },
});

console.log(`🌐 Dev server: http://localhost:${server.port}`);

// ── Launch native shell ───────────────────────────────
console.log('🚀 Launching app...');
const proc = Bun.spawn([exePath, '--dev', `http://localhost:${PORT}`], {
    stdout: 'inherit',
    stderr: 'inherit',
});

const code = await proc.exited;
server.stop();
process.exit(code);
