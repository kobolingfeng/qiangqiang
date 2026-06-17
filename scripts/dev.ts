// scripts/dev.ts — Dev mode: build frontend + serve + launch native shell
// Supports built-in Bun bundler or custom dev server (Vite, Webpack, etc.)
import { existsSync, mkdirSync, watch } from 'fs';
import { join, resolve } from 'path';
import { createServer } from 'net';
import { splitCommandLine, withResolvedDevServerPort } from './dev-utils';

const ROOT = resolve(import.meta.dir, '..');
const DIST = join(ROOT, 'dist');
const SRC  = join(ROOT, 'src');

// ── Load config ───────────────────────────────────────
let PORT = 3000;
const DEV_HOST = '127.0.0.1';
let devCommand: string | undefined;
let waitForPort = true;
try {
    const cfg = await Bun.file(join(ROOT, 'app.config.json')).json();
    PORT       = Number(process.env.PORT || cfg?.dev?.port || 3000);
    devCommand = cfg?.dev?.command;
    waitForPort = cfg?.dev?.waitForPort ?? true;
} catch {}

async function isPortFree(port: number) {
    return new Promise<boolean>((resolve) => {
        const server = createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => server.close(() => resolve(true)));
        server.listen(port, DEV_HOST);
    });
}

async function pickPort(preferred: number) {
    for (let port = preferred; port < preferred + 50; port++) {
        if (await isPortFree(port)) {
            if (port !== preferred) {
                console.log(`⚠️ Port ${preferred} is busy, using ${port} instead.`);
            }
            return port;
        }
    }
    throw new Error(`No free dev port found from ${preferred} to ${preferred + 49}`);
}

PORT = await pickPort(PORT);

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

    const [cmd, ...rawArgs] = splitCommandLine(devCommand);
    if (!cmd) {
        console.error('❌ dev.command is empty.');
        process.exit(1);
    }
    const args = withResolvedDevServerPort(cmd, rawArgs, PORT);
    const devProc = Bun.spawn([cmd, ...args], {
        cwd: ROOT,
        stdout: 'inherit',
        stderr: 'inherit',
        env: { ...process.env, PORT: String(PORT), VITE_PORT: String(PORT) },
    });

    if (waitForPort) {
        const devOrigin = `http://${DEV_HOST}:${PORT}`;
        console.log(`⏳ Waiting for dev server on ${devOrigin}...`);
        const start = Date.now();
        const timeout = 30000;
        let ready = false;
        while (Date.now() - start < timeout) {
            try {
                await fetch(devOrigin);
                ready = true;
                break;
            } catch {
                await Bun.sleep(300);
            }
        }
        if (!ready) {
            devProc.kill();
            console.error(`❌ Dev server did not become reachable on port ${PORT} within ${timeout / 1000}s.`);
            process.exit(1);
        }
    }

    const devOrigin = `http://${DEV_HOST}:${PORT}`;
    console.log(`🚀 Launching app → ${devOrigin}`);
    const appProc = Bun.spawn([exePath, '--dev', devOrigin], {
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
    hostname: DEV_HOST,
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

const builtInDevOrigin = `http://${DEV_HOST}:${server.port}`;
console.log(`🌐 Dev server: ${builtInDevOrigin}`);

// ── Launch native shell ───────────────────────────────
console.log('🚀 Launching app...');
const proc = Bun.spawn([exePath, '--dev', builtInDevOrigin], {
    stdout: 'inherit',
    stderr: 'inherit',
});

const code = await proc.exited;
server.stop();
process.exit(code);
