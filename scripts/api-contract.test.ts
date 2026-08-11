import { describe, expect, test } from 'bun:test';

const nativeSource = await Bun.file('native/main.cpp').text();
const apiSource = await Bun.file('src/api.ts').text();
const chineseReadme = await Bun.file('README.md').text();
const englishReadme = await Bun.file('README.en.md').text();

const nativeCommands = [
    ...nativeSource.matchAll(/ipc_on(?:_async)?\(\s*"([^"]+)"/g),
].map((match) => match[1]);

const nativeEvents = [
    ...new Set(
        [...nativeSource.matchAll(/ipc_emit\(\s*"([^"]+)"/g)].map((match) => match[1]),
    ),
];

describe('public API contract', () => {
    test('native command names are unique and have typed frontend wrappers', () => {
        expect(new Set(nativeCommands).size).toBe(nativeCommands.length);
        expect(nativeCommands).toHaveLength(93);
        for (const command of nativeCommands) {
            expect(apiSource).toContain(`'${command}'`);
        }
    });

    test('native events are unique and exposed by the frontend API', () => {
        expect(nativeEvents).toHaveLength(16);
        for (const event of nativeEvents) {
            expect(apiSource).toContain(`'${event}'`);
        }
    });

    test('both readmes publish the authoritative API totals', () => {
        for (const readme of [chineseReadme, englishReadme]) {
            expect(readme).toContain('93');
            expect(readme).toContain('16');
        }
    });
});
