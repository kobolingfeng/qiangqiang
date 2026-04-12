// scripts/dev.ts — Dev mode: build frontend + serve + launch native shell
// Supports built-in Bun bundler or custom dev server (Vite, Webpack, etc.)
import { existsSync, mkdirSync, watch } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dir, '..');
const DIST = join(ROOT, 'dist');
const SRC  = join(ROOT, 'src');

// ── Load config ───────────────────────────────────────
let PORT = 3000;
let devCommand: string | undefined;
let waitForPort = true;
try {
    const cfg = await Bun.file(join(ROOT, 'app.config.json')).json();
    PORT       = cfg?.dev?.port ?? 3000;
    devCommand = cfg?.dev?.command;
    waitForPort = cfg?.dev?.waitForPort ?? true;
} catch {}

// ── Check native exe ──────────────────────────────────
const exePath = join(DIST, 'app.exe');
if (!existsSync(exePath)) {
    console.log('Native shell not found. Building native only...\n');
    const r = Bun.spawnSync(['bun', 'run', 'build:native'], { cwd: ROOT, stdout: 'inherit', stderr: 'inherit' });
    if (r.exitCode !== 0) {
        // Fallback: full build
        const r2 = Bun.spawnSync(['bun', 'run', 'build'], { cwd: ROOT, stdout: 'inherit', stderr: 'inherit' });
        if (r2.exitCode !== 0) {
            console.error('\n❌ Build failed. Fix errors and try again.');
            process.exit(1);
        }
    }
    console.log('');
}

// ── Custom dev command (Vite, Webpack, etc.) ──────────
if (devCommand) {
    console.log(`🔧 Using custom dev server: ${devCommand}`);

    // Copy config to dist for native shell
    mkdirSync(DIST, { recursive: true });
    const cfgSrc = join(ROOT, 'app.config.json');
    if (existsSync(cfgSrc))
        await Bun.write(join(DIST, 'app.config.json'), Bun.file(cfgSrc));

    const [cmd, ...args] = devCommand.split(' ');
    const devProc = Bun.spawn([cmd, ...args], {
        cwd: ROOT,
        stdout: 'inherit',
        stderr: 'inherit',
        env: { ...process.env, PORT: String(PORT) },
    });

    if (waitForPort) {
        console.log(`⏳ Waiting for dev server on port ${PORT}...`);
        const start = Date.now();
        const timeout = 30000;
        while (Date.now() - start < timeout) {
            try {
                await fetch(`http://localhost:${PORT}`);
                break;
            } catch {
                await Bun.sleep(300);
            }
        }
    }

    console.log(`🚀 Launching app → http://localhost:${PORT}`);
    const appProc = Bun.spawn([exePath, '--dev', `http://localhost:${PORT}`], {
        stdout: 'inherit',
        stderr: 'inherit',
    });

    const code = await appProc.exited;
    devProc.kill();
    process.exit(code);
}

// ── Built-in Bun bundler (default) ────────────────────
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

const server = Bun.serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);

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
