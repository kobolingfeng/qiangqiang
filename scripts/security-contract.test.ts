import { describe, expect, test } from 'bun:test';

const nativeSource = await Bun.file('native/main.cpp').text();

describe('WebView trust boundary', () => {
    test('privileged IPC checks the sender origin', () => {
        expect(nativeSource).toContain('a->get_Source(&source)');
        expect(nativeSource).toContain('is_trusted_webview_url(source)');
        expect(nativeSource).toContain('if (!trusted) return S_OK;');
    });

    test('top-level navigation and popups cannot leave the app boundary', () => {
        expect(nativeSource).toContain('add_NavigationStarting');
        expect(nativeSource).toContain('if (!trusted) args->put_Cancel(TRUE);');
        expect(nativeSource).toContain('add_NewWindowRequested');
        expect(nativeSource).toContain('args->put_Handled(TRUE);');
    });
});
