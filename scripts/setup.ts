// scripts/setup.ts — One-time: download WebView2 SDK + nlohmann/json
import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dir, '..');
const DEPS = join(ROOT, 'deps');

async function downloadWebView2() {
    const dir = join(DEPS, 'webview2');
    const marker = join(dir, 'build', 'native', 'include', 'WebView2.h');

    if (existsSync(marker)) {
        console.log('✓ WebView2 SDK already present');
        return;
    }

    console.log('⬇ Downloading WebView2 SDK (NuGet)...');
    const resp = await fetch('https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2');
    if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);

    const zipPath = join(DEPS, 'webview2.zip');
    await Bun.write(zipPath, await resp.arrayBuffer());

    console.log('  Extracting...');
    const r = Bun.spawnSync(['powershell', '-NoProfile', '-Command',
        `Remove-Item '${dir}' -Recurse -Force -ErrorAction SilentlyContinue; ` +
        `Expand-Archive -Path '${zipPath}' -DestinationPath '${dir}' -Force; ` +
        `Remove-Item '${zipPath}'`
    ]);
    if (r.exitCode !== 0) throw new Error('Extraction failed');

    if (!existsSync(marker)) throw new Error('WebView2.h not found after extraction');
    console.log('✓ WebView2 SDK ready');
}

async function downloadJson() {
    const dir = join(DEPS, 'json');
    const file = join(dir, 'json.hpp');

    if (existsSync(file)) {
        console.log('✓ json.hpp already present');
        return;
    }

    console.log('⬇ Downloading nlohmann/json...');
    mkdirSync(dir, { recursive: true });
    const resp = await fetch('https://github.com/nlohmann/json/releases/download/v3.11.3/json.hpp');
    if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
    await Bun.write(file, await resp.arrayBuffer());
    console.log('✓ json.hpp ready');
}

async function main() {
    mkdirSync(DEPS, { recursive: true });
    await downloadWebView2();
    await downloadJson();
    console.log('\n✅ Setup complete. Run `bun run build` then `bun run dev`.');
}

main().catch(e => { console.error('❌ Setup failed:', e.message); process.exit(1); });
