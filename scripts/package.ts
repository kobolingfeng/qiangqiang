// scripts/package.ts — Package dist/ into a portable zip
import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dir, '..');
const dist = join(root, 'dist');
const out  = join(root, 'release');
const singleExe = process.argv.includes('--single-exe');
const buildCommand = singleExe ? 'bun run build:single' : 'bun run build';

// Ensure built
if (singleExe || !existsSync(join(dist, 'app.exe'))) {
    console.log('📦 Building first...');
    execSync(buildCommand, { cwd: root, stdio: 'inherit' });
}

// Read config for name
let name = 'app';
try {
    const cfg = JSON.parse(readFileSync(join(root, 'app.config.json'), 'utf8'));
    name = cfg.window?.title || name;
} catch {}

mkdirSync(out, { recursive: true });
const zipName = `${name}-${singleExe ? 'single' : 'portable'}.zip`;
const zipPath = join(out, zipName);

console.log(`📦 Packaging → release/${zipName}`);

if (singleExe) {
    execSync(
        `powershell -NoProfile -Command "Compress-Archive -LiteralPath '${join(dist, 'app.exe')}' -DestinationPath '${zipPath}' -Force"`,
        { cwd: root, stdio: 'inherit' }
    );
} else {
    execSync(
        `powershell -NoProfile -Command "Compress-Archive -Path '${dist}\\*' -DestinationPath '${zipPath}' -Force"`,
        { cwd: root, stdio: 'inherit' }
    );
}

const { size } = Bun.file(zipPath);
console.log(`✅ ${zipName} (${(size / 1024).toFixed(0)} KB)`);
