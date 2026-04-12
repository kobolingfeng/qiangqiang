// scripts/build.ts — Build frontend (Bun) + compile native shell (MSVC)
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';

const ROOT = resolve(import.meta.dir, '..');
const DIST = join(ROOT, 'dist');
const DEPS = join(ROOT, 'deps');

// ── Check deps ────────────────────────────────────────
const wv2Inc = join(DEPS, 'webview2', 'build', 'native', 'include');
const wv2Lib = join(DEPS, 'webview2', 'build', 'native', 'x64', 'WebView2LoaderStatic.lib');
const jsonInc = join(DEPS, 'json');

if (!existsSync(join(wv2Inc, 'WebView2.h')) || !existsSync(join(jsonInc, 'json.hpp'))) {
    console.error('❌ Dependencies missing. Run `bun run setup` first.');
    process.exit(1);
}

mkdirSync(DIST, { recursive: true });

// ── 1. Build frontend ─────────────────────────────────
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

// Copy HTML, replace .ts → .js reference
let html = await Bun.file(join(ROOT, 'src', 'index.html')).text();
html = html.replace('./main.ts', './main.js');
await Bun.write(join(DIST, 'index.html'), html);
// Copy config
const configSrc = join(ROOT, 'app.config.json');
if (existsSync(configSrc)) {
    const cfg = await Bun.file(configSrc).text();
    await Bun.write(join(DIST, 'app.config.json'), cfg);
}

console.log('✓ Frontend built');

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

// ── 3. Compile ────────────────────────────────────────
const mainCpp = join(ROOT, 'native', 'main.cpp');
const outExe = join(DIST, 'app.exe');

// Compile resource file if icon exists
const rcFile = join(ROOT, 'native', 'app.rc');
const icoFile = join(ROOT, 'native', 'app.ico');
const resFile = join(ROOT, 'native', 'app.res');
let linkRes = '';
if (existsSync(rcFile) && existsSync(icoFile)) {
    const rcCmd = `call "${vcvarsall}" x64 >nul 2>&1 && rc /nologo /fo "${resFile}" "${rcFile}"`;
    try {
        execSync(rcCmd, { cwd: ROOT, stdio: 'inherit' });
        linkRes = `"${resFile}"`;
    } catch {
        console.warn('⚠️ Resource compilation failed, building without icon');
    }
}

const clArgs = [
    '/nologo /EHsc /O2 /std:c++20 /utf-8',
    '/DUNICODE /D_UNICODE',
    `"${mainCpp}"`,
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
Bun.spawnSync(['cmd', '/c', 'del /q *.obj 2>nul'], { cwd: ROOT });
console.log('✓ Native shell compiled');

// ── Done ──────────────────────────────────────────────
console.log(`\n✅ Build complete → ${DIST}`);
console.log('   Run: bun run dev');
console.log('   Or:  dist\\app.exe');
