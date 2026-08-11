import { describe, expect, test } from 'bun:test';
import { resolve } from 'path';
import {
    getAppExecutableName,
    resolveDevAssetPath,
    sanitizeArtifactName,
    splitCommandLine,
    withResolvedDevServerPort,
} from './dev-utils';

describe('artifact naming', () => {
    test('uses one safe name for builds and packages', () => {
        expect(getAppExecutableName('My: App. ')).toBe('My- App.exe');
        expect(sanitizeArtifactName('  ')).toBe('app');
        expect(getAppExecutableName('CON')).toBe('CON-app.exe');
    });
});

describe('dev asset paths', () => {
    const root = resolve('dist');

    test('decodes local asset names', () => {
        expect(resolveDevAssetPath(root, '/images/My%20File.png')).toBe(resolve(root, 'images/My File.png'));
        expect(resolveDevAssetPath(root, '/')).toBe(resolve(root, 'index.html'));
    });

    test('does not escape the dist directory', () => {
        expect(resolveDevAssetPath(root, '/..%2fpackage.json')).toBeNull();
        expect(resolveDevAssetPath(root, '/%E0%A4%A')).toBeNull();
    });
});

describe('custom dev commands', () => {
    test('splits quoted command arguments', () => {
        expect(splitCommandLine('bun run "dev server" --flag')).toEqual(['bun', 'run', 'dev server', '--flag']);
    });

    test('adds Vite host and resolved port once', () => {
        expect(withResolvedDevServerPort('vite', [], 3012)).toEqual([
            '--host', '127.0.0.1', '--port', '3012',
        ]);
        expect(withResolvedDevServerPort('vite', ['--port=4000'], 3012)).toEqual([
            '--port=4000', '--host', '127.0.0.1',
        ]);
    });
});
