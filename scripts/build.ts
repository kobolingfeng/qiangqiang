// scripts/build.ts — Build frontend (Bun) + compile native shell (MSVC)
// Supports single-exe mode: embeds HTML+config as Win32 RCDATA resources
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';

const ROOT = resolve(import.meta.dir, '..');
const DIST = join(ROOT, 'dist');
const DEPS = join(ROOT, 'deps');

// Check for --single-exe flag
const singleExe = process.argv.includes('--single-exe');

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

// Read built JS
const jsContent = await Bun.file(join(DIST, 'main.js')).text();

// Build HTML with inlined JS for single-exe, or external ref for normal mode
let html = await Bun.file(join(ROOT, 'src', 'index.html')).text();
if (singleExe) {
    // Replace <script type="module" src="./main.ts"></script> with inline script
    html = html.replace(
        /<script[^>]*src=["']\.\/main\.ts["'][^>]*><\/script>/,
        `<script type="module">${jsContent}</script>`
    );
} else {
    html = html.replace('./main.ts', './main.js');
}
await Bun.write(join(DIST, 'index.html'), html);

// Copy config
const configSrc = join(ROOT, 'app.config.json');
if (existsSync(configSrc)) {
    const cfg = await Bun.file(configSrc).text();
    await Bun.write(join(DIST, 'app.config.json'), cfg);
}

console.log('✓ Frontend built' + (singleExe ? ' (single-exe: JS inlined)' : ''));

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
const outExe = join(DIST, 'app.exe');

// Always compile icon resource
const rcFile = join(ROOT, 'native', 'app.rc');
const icoFile = join(ROOT, 'native', 'app.ico');
const resFile = join(ROOT, 'native', 'app.res');

if (singleExe) {
    // Write embedded HTML and config as raw files next to the RC
    const embeddedHtml = join(ROOT, 'native', '_embedded.html');
    const embeddedCfg  = join(ROOT, 'native', '_embedded.json');
    writeFileSync(embeddedHtml, html, 'utf-8');
    const cfgContent = existsSync(configSrc) ? await Bun.file(configSrc).text() : '{}';
    writeFileSync(embeddedCfg, cfgContent, 'utf-8');

    // Generate dynamic RC
    const rcContent = [
        '#include "resource.h"',
        ...(existsSync(icoFile) ? ['IDI_APP ICON "app.ico"'] : []),
        'IDR_HTML   RCDATA "_embedded.html"',
        'IDR_CONFIG RCDATA "_embedded.json"',
    ].join('\n');
    writeFileSync(rcFile, rcContent, 'utf-8');
    console.log('  → Embedded HTML + config as RCDATA resources');
} else {
    // Standard icon-only RC
    if (existsSync(icoFile)) {
        writeFileSync(rcFile, 'IDI_APP ICON "app.ico"\n', 'utf-8');
    }
}

let linkRes = '';
if (existsSync(rcFile)) {
    const rcCmd = `call "${vcvarsall}" x64 >nul 2>&1 && rc /nologo /I"${join(ROOT, 'native')}" /fo "${resFile}" "${rcFile}"`;
    try {
        execSync(rcCmd, { cwd: ROOT, stdio: 'inherit' });
        linkRes = `"${resFile}"`;
    } catch {
        console.warn('⚠️ Resource compilation failed, building without resources');
    }
}

// ── 4. Compile ────────────────────────────────────────
const defines = singleExe ? '/DSINGLE_EXE' : '';

const clArgs = [
    '/nologo /EHsc /O2 /std:c++20 /utf-8',
    '/DUNICODE /D_UNICODE',
    defines,
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
if (singleExe) {
    // Clean up temp embedded files
    try { unlinkSync(join(ROOT, 'native', '_embedded.html')); } catch {}
    try { unlinkSync(join(ROOT, 'native', '_embedded.json')); } catch {}
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
