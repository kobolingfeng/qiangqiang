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
