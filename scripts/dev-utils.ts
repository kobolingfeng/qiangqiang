import { isAbsolute, relative, resolve, sep } from 'path';

const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export function sanitizeArtifactName(value: unknown, fallback = 'app'): string {
    let name = typeof value === 'string' ? value : '';
    name = name
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[. ]+$/g, '');

    if (!name) name = fallback;
    if (WINDOWS_RESERVED_NAME.test(name)) name += '-app';

    // Leave room for extensions while staying below Windows' 255 UTF-16-unit component limit.
    if (name.length > 240) {
        name = name.slice(0, 240).replace(/[\uD800-\uDBFF]$/, '').replace(/[. ]+$/g, '');
    }
    return name || fallback;
}

export function getAppExecutableName(title: unknown): string {
    return `${sanitizeArtifactName(title)}.exe`;
}

export function resolveDevAssetPath(root: string, pathname: string): string | null {
    let decoded: string;
    try {
        decoded = decodeURIComponent(pathname);
    } catch {
        return null;
    }

    if (decoded.includes('\0')) return null;
    const requestPath = decoded.replace(/\\/g, '/').replace(/^\/+/, '') || 'index.html';
    const candidate = resolve(root, requestPath);
    const fromRoot = relative(resolve(root), candidate);
    if (fromRoot === '' || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== '..' && !isAbsolute(fromRoot))) {
        return candidate;
    }
    return null;
}

export function splitCommandLine(command: string): string[] {
    const parts: string[] = [];
    const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(command)) !== null) {
        parts.push(match[1] ?? match[2] ?? match[3]);
    }
    return parts;
}

export function withResolvedDevServerPort(cmd: string, args: string[], port: number): string[] {
    const tokens = [cmd, ...args].map((part) => part.toLowerCase());
    const isVite = tokens.some((part) => /(^|[\\/])vite(\.cmd|\.exe)?$/.test(part) || part === 'vite');
    if (!isVite) return args;

    const hasPort = args.some((part) => part === '--port' || part === '-p' || part.startsWith('--port=') || part.startsWith('-p='));
    const hasHost = args.some((part) => part === '--host' || part === '-H' || part.startsWith('--host=') || part.startsWith('-H='));
    return [
        ...args,
        ...(hasHost ? [] : ['--host', '127.0.0.1']),
        ...(hasPort ? [] : ['--port', String(port)]),
    ];
}
