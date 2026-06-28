// scripts/build.ts — Build frontend + compile native shell (MSVC)
// Supports built-in Bun bundler or custom build commands (Vite, Webpack, etc.)
// Single-exe mode: embeds HTML+config as Win32 RCDATA resources
import { existsSync, mkdirSync, readFileSync, readdirSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';

const ROOT = resolve(import.meta.dir, '..');
const DIST = join(ROOT, 'dist');
const DEPS = join(ROOT, 'deps');

const singleExe  = process.argv.includes('--single-exe');
const nativeOnly  = process.argv.includes('--native-only');
const frontendOnly = process.argv.includes('--frontend-only');

const buildLockRoot = join(ROOT, 'native', 'build');
const buildLockDir = join(buildLockRoot, '.build.lock');

function releaseBuildLock() {
    try { unlinkSync(join(buildLockDir, 'owner.txt')); } catch {}
    try { rmdirSync(buildLockDir); } catch {}
}

async function acquireBuildLock(timeoutMs = 5 * 60 * 1000) {
    mkdirSync(buildLockRoot, { recursive: true });
    const startedAt = Date.now();
    while (true) {
        try {
            mkdirSync(buildLockDir);
            writeFileSync(join(buildLockDir, 'owner.txt'), `${process.pid}\n${new Date().toISOString()}\n`, 'utf-8');
            return;
        } catch {
            try {
                const ageMs = Date.now() - statSync(buildLockDir).mtimeMs;
                if (ageMs > timeoutMs) releaseBuildLock();
            } catch {}
            if (Date.now() - startedAt > timeoutMs) {
                throw new Error('Timed out waiting for another build to finish.');
            }
            await Bun.sleep(250);
        }
    }
}

const packagedAssetExtensions = new Set([
    '.avif', '.css', '.gif', '.htm', '.html', '.ico', '.jpeg', '.jpg',
    '.js', '.json', '.map', '.mjs', '.otf', '.png', '.svg', '.ttf', '.txt',
    '.wasm', '.webmanifest', '.webp', '.woff', '.woff2', '.xml',
]);

function normalizeHtmlAssetRef(value: string): string | null {
    let ref = value.trim();
    if (!ref || ref.startsWith('#')) return null;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(ref)) return null;

    ref = ref.split(/[?#]/, 1)[0].replace(/\\/g, '/');
    if (ref.startsWith('./')) ref = ref.slice(2);
    while (ref.startsWith('/')) ref = ref.slice(1);
    if (!ref || ref.startsWith('../')) return null;

    try { ref = decodeURIComponent(ref); } catch {}

    const slash = ref.lastIndexOf('/');
    const fileName = slash >= 0 ? ref.slice(slash + 1) : ref;
    const dot = fileName.lastIndexOf('.');
    if (dot < 0) return null;
    const ext = fileName.slice(dot).toLowerCase();
    return packagedAssetExtensions.has(ext) ? ref : null;
}

await acquireBuildLock();
process.once('exit', releaseBuildLock);

// ── Load config ───────────────────────────────────────
let buildCommand: string | undefined;
let buildOutDir: string | undefined;
let appTitle = 'app';
try {
    const cfg = await Bun.file(join(ROOT, 'app.config.json')).json();
    buildCommand = cfg?.build?.command;
    buildOutDir  = cfg?.build?.outDir;
    appTitle     = cfg?.window?.title || 'app';
} catch {}
// Output exe is named after the app title (so users get a branded exe, not app.exe).
const EXE_NAME = (appTitle.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim() || 'app') + '.exe';

// ── Check deps ────────────────────────────────────────
const wv2Inc  = join(DEPS, 'webview2', 'build', 'native', 'include');
const wv2Lib  = join(DEPS, 'webview2', 'build', 'native', 'x64', 'WebView2LoaderStatic.lib');
const jsonInc = join(DEPS, 'json');

if (!frontendOnly && (!existsSync(join(wv2Inc, 'WebView2.h')) || !existsSync(join(jsonInc, 'json.hpp')))) {
    console.error('❌ Dependencies missing. Run `bun run setup` first.');
    process.exit(1);
}

mkdirSync(DIST, { recursive: true });

// ── 1. Build frontend ─────────────────────────────────
if (!nativeOnly) {
    if (buildCommand) {
        // Custom build command (Vite, Webpack, etc.)
        console.log(`📦 Building frontend: ${buildCommand}`);
        try {
            execSync(buildCommand, { cwd: ROOT, stdio: 'inherit' });
        } catch {
            console.error('❌ Frontend build failed');
            process.exit(1);
        }

        // If custom outDir specified and differs from dist, copy files
        if (buildOutDir && resolve(ROOT, buildOutDir) !== resolve(DIST)) {
            const srcDir = resolve(ROOT, buildOutDir);
            console.log(`  → Copying ${srcDir} → ${DIST}`);
            execSync(`xcopy /E /Y /I "${srcDir}" "${DIST}"`, { cwd: ROOT, stdio: 'inherit' });
        }

        console.log('✓ Frontend built (custom)');
    } else {
        // Built-in Bun bundler
        console.log('📦 Building frontend...');

        const result = await Bun.build({
            entrypoints: [join(ROOT, 'src', 'main.ts')],
            outdir: DIST,
            minify: true,
            target: 'browser',
        });

        if (!result.success) {
            console.error('❌ Frontend build failed:', result.logs);
            process.exit(1);
        }

        const jsContent = await Bun.file(join(DIST, 'main.js')).text();

        let html = await Bun.file(join(ROOT, 'src', 'index.html')).text();
        let inlined = false;
        if (singleExe) {
            // Escape any literal </script> in the bundle so it can't terminate the inline
            // <script> early — a classic cause of a blank single-exe window.
            const safeJs = jsContent.replace(/<\/script>/gi, '<\\/script>');
            const before = html;
            html = html.replace(
                /<script[^>]*src=["']\.\/main\.ts["'][^>]*><\/script>/,
                `<script type="module">${safeJs}</script>`
            );
            inlined = html !== before;
            // If the entry <script> didn't match (custom tag, Vite, etc.), don't silently
            // ship an unservable ./main.ts — fall back to referencing the packed main.js.
            if (!inlined) html = html.replace(/\.\/main\.ts/g, './main.js');
        } else {
            html = html.replace('./main.ts', './main.js');
        }
        await Bun.write(join(DIST, 'index.html'), html);
        console.log('✓ Frontend built' + (singleExe ? (inlined ? ' (single-exe: JS inlined)' : ' (single-exe: JS from pak)') : ''));
    }

    // Always copy config to dist
    const configSrc = join(ROOT, 'app.config.json');
    if (existsSync(configSrc)) {
        await Bun.write(join(DIST, 'app.config.json'), Bun.file(configSrc));
    }
}

if (frontendOnly) {
    console.log('\n✅ Frontend build complete → ' + DIST);
    process.exit(0);
}

// ── 2. Find MSVC ──────────────────────────────────────
console.log('🔨 Compiling native shell...');

const vswhere = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe';
if (!existsSync(vswhere)) {
    console.error('❌ Visual Studio / Build Tools not found.');
    console.error('   Install: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022');
    process.exit(1);
}

const vsProc = Bun.spawnSync([vswhere, '-products', '*', '-latest', '-property', 'installationPath']);
const vsPath = vsProc.stdout.toString().trim();
if (!vsPath) {
    console.error('❌ MSVC C++ toolchain not found. Install VS Build Tools.');
    process.exit(1);
}

const vcvarsall = join(vsPath, 'VC', 'Auxiliary', 'Build', 'vcvarsall.bat');

// ── 3. Generate resource file for single-exe ──────────
const mainCpp = join(ROOT, 'native', 'main.cpp');
const outExe  = join(DIST, EXE_NAME);
const buildMode = singleExe ? 'single' : 'portable';
const nativeBuildDir = join(ROOT, 'native', 'build', buildMode);
mkdirSync(nativeBuildDir, { recursive: true });
const rcFile  = join(ROOT, 'native', `app-${buildMode}.rc`);
const icoFile = join(ROOT, 'native', 'app.ico');
const resFile = join(ROOT, 'native', `app-${buildMode}.res`);

if (singleExe) {
    const pakFile    = join(ROOT, 'native', `_embedded-${buildMode}.pak`);
    const embeddedCfg = join(ROOT, 'native', `_embedded-${buildMode}.json`);

    // Collect all files from dist/ into a pak archive
    // Format: "QQ" (2B) + fileCount (uint16) + [pathLen(uint16) + path + dataLen(uint32) + data]...
    const distFiles: { path: string; data: Buffer }[] = [];
    const skipDirs = new Set(['data', 'EBWebView']);
    const collectFiles = (dir: string, prefix: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            const rel = prefix ? prefix + '/' + entry.name : entry.name;
            if (entry.isDirectory()) {
                if (!skipDirs.has(entry.name)) collectFiles(full, rel);
            } else if (entry.name !== EXE_NAME && entry.name !== 'app.exe' && entry.name !== 'app.config.json') {
                distFiles.push({ path: rel, data: readFileSync(full) });
            }
        }
    };
    collectFiles(DIST, '');

    const packedPaths = new Set(distFiles.map(f => f.path.replace(/\\/g, '/')));
    const indexEntry = distFiles.find(f => f.path.replace(/\\/g, '/') === 'index.html');
    if (!indexEntry) {
        console.error('❌ Single-exe build failed: dist/index.html was not packed.');
        console.error('   Build the frontend first and make sure it emits index.html into dist/.');
        process.exit(1);
    }

    const indexHtml = indexEntry.data.toString('utf-8');
    const referencedLocalAssets = new Set<string>();
    for (const match of indexHtml.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
        const asset = normalizeHtmlAssetRef(match[1]);
        if (asset) referencedLocalAssets.add(asset);
    }
    const missingAssets = [...referencedLocalAssets].filter(asset => !packedPaths.has(asset));
    if (missingAssets.length > 0) {
        console.error('❌ Single-exe build failed: frontend references files that were not packed:');
        for (const asset of missingAssets) console.error('   - ' + asset);
        process.exit(1);
    }

    if (distFiles.length > 0xffff) {
        console.error(`❌ Single-exe build failed: too many files for the pak format (${distFiles.length}).`);
        process.exit(1);
    }
    for (const f of distFiles) {
        const pathLen = Buffer.byteLength(f.path);
        if (pathLen > 0xffff) {
            console.error('❌ Single-exe build failed: packed path is too long: ' + f.path);
            process.exit(1);
        }
        if (f.data.length > 0xffffffff) {
            console.error('❌ Single-exe build failed: packed file is too large: ' + f.path);
            process.exit(1);
        }
    }

    // Build pak binary
    let totalSize = 4; // magic(2) + count(2)
    for (const f of distFiles) totalSize += 2 + Buffer.byteLength(f.path) + 4 + f.data.length;
    const pak = Buffer.alloc(totalSize);
    let off = 0;
    pak.write('QQ', 0); off += 2;
    pak.writeUInt16LE(distFiles.length, off); off += 2;
    for (const f of distFiles) {
        const pathBuf = Buffer.from(f.path, 'utf-8');
        pak.writeUInt16LE(pathBuf.length, off); off += 2;
        pathBuf.copy(pak, off); off += pathBuf.length;
        pak.writeUInt32LE(f.data.length, off); off += 4;
        f.data.copy(pak, off); off += f.data.length;
    }
    writeFileSync(pakFile, pak);
    console.log(`  → Packed ${distFiles.length} files into pak (${(pak.length / 1024).toFixed(1)} KB)`);

    // Config as separate resource (loaded before WebView2)
    const configSrc = join(ROOT, 'app.config.json');
    const cfgContent = existsSync(configSrc) ? await Bun.file(configSrc).text() : '{}';
    writeFileSync(embeddedCfg, cfgContent, 'utf-8');

    const rcContent = [
        '#include "resource.h"',
        ...(existsSync(icoFile) ? ['IDI_APP ICON "app.ico"'] : []),
        `IDR_HTML   RCDATA "_embedded-${buildMode}.pak"`,
        `IDR_CONFIG RCDATA "_embedded-${buildMode}.json"`,
    ].join('\n');
    writeFileSync(rcFile, rcContent, 'utf-8');
} else {
    if (existsSync(icoFile)) {
        writeFileSync(rcFile, '#include "resource.h"\nIDI_APP ICON "app.ico"\n', 'utf-8');
    }
}

let linkRes = '';
if (existsSync(rcFile)) {
    const rcCmd = `call "${vcvarsall}" x64 >nul 2>&1 && rc /nologo /I"${join(ROOT, 'native')}" /fo "${resFile}" "${rcFile}"`;
    try {
        execSync(rcCmd, { cwd: ROOT, stdio: 'inherit' });
        linkRes = `"${resFile}"`;
    } catch {
        if (singleExe) {
            console.error('❌ Resource compilation failed.');
            console.error('   Single-exe builds must embed the frontend into the exe.');
            console.error('   Otherwise the app will only run while index.html/main.js are still beside dist\\app.exe.');
            process.exit(1);
        }
        console.warn('⚠️ Resource compilation failed, building without resources');
    }
}

if (singleExe && !linkRes) {
    console.error('❌ Single-exe build aborted because no embedded resource was linked.');
    process.exit(1);
}

// ── 4. Compile ────────────────────────────────────────
const defines = singleExe ? '/DSINGLE_EXE' : '';
const objFile = join(nativeBuildDir, 'main.obj');

const clArgs = [
    '/nologo /EHsc /O2 /std:c++20 /utf-8',
    '/DUNICODE /D_UNICODE',
    defines,
    `"${mainCpp}"`,
    `/Fo:"${objFile}"`,
    `/I"${wv2Inc}"`,
    `/I"${jsonInc}"`,
    `/Fe:"${outExe}"`,
    '/link /SUBSYSTEM:WINDOWS',
    `"${wv2Lib}"`,
    'user32.lib gdi32.lib ole32.lib shell32.lib shlwapi.lib advapi32.lib comdlg32.lib winhttp.lib',
    linkRes,
].join(' ');

const buildCmd = `call "${vcvarsall}" x64 >nul 2>&1 && cl ${clArgs}`;

try {
    execSync(buildCmd, { cwd: ROOT, stdio: 'inherit' });
} catch {
    console.error('❌ Native compilation failed');
    process.exit(1);
}

// Cleanup intermediate files
try { unlinkSync(rcFile); } catch {}
try { unlinkSync(resFile); } catch {}
if (singleExe) {
    try { unlinkSync(join(ROOT, 'native', `_embedded-${buildMode}.pak`)); } catch {}
    try { unlinkSync(join(ROOT, 'native', `_embedded-${buildMode}.json`)); } catch {}
}
console.log('✓ Native shell compiled' + (singleExe ? ' (single-exe mode)' : ''));

// ── Done ──────────────────────────────────────────────
if (singleExe) {
    console.log(`\n✅ Single-exe build → ${outExe}`);
    console.log('   The exe contains all HTML/JS/CSS + config. No external files needed.');
} else {
    console.log(`\n✅ Build complete → ${DIST}`);
    console.log('   Run: bun run dev');
    console.log('   Or:  dist\\app.exe');
}
