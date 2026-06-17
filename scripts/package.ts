// scripts/package.ts — Package dist/ into a portable zip
import { execFileSync, execSync } from 'child_process';
import { mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dir, '..');
const dist = join(root, 'dist');
const out  = join(root, 'release');
const singleExe = process.argv.includes('--single-exe');
const buildCommand = singleExe ? 'bun run build:single' : 'bun run build';

function sanitizeFileName(value: string): string {
    return value
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[. ]+$/g, '') || 'app';
}

function quotePowerShell(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}

function compressArchive(sourcePath: string, destinationPath: string, useLiteralPath = true) {
    const pathParameter = useLiteralPath ? '-LiteralPath' : '-Path';
    execFileSync(
        'powershell',
        [
            '-NoProfile',
            '-Command',
            `Compress-Archive ${pathParameter} ${quotePowerShell(sourcePath)} -DestinationPath ${quotePowerShell(destinationPath)} -Force`,
        ],
        { cwd: root, stdio: 'inherit' },
    );
}

// Always build before packaging so release artifacts cannot lag behind source edits.
console.log('📦 Building first...');
execSync(buildCommand, { cwd: root, stdio: 'inherit' });

// Read config for name
let name = 'app';
try {
    const cfg = JSON.parse(readFileSync(join(root, 'app.config.json'), 'utf8'));
    name = cfg.window?.title || name;
} catch {}

mkdirSync(out, { recursive: true });
const zipName = `${sanitizeFileName(name)}-${singleExe ? 'single' : 'portable'}.zip`;
const zipPath = join(out, zipName);

console.log(`📦 Packaging → release/${zipName}`);

if (singleExe) {
    compressArchive(join(dist, 'app.exe'), zipPath);
} else {
    compressArchive(join(dist, '*'), zipPath, false);
}

const { size } = Bun.file(zipPath);
console.log(`✅ ${zipName} (${(size / 1024).toFixed(0)} KB)`);
