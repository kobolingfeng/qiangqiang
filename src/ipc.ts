// IPC bridge — frontend ↔ native shell communication
// Protocol:
//   Request:  { id, cmd, args }
//   Response: { id, result } | { id, error }
//   Event:    { event, data }

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void };

const pending = new Map<number, Pending>();
let nextId = 0;

const hasWebView = typeof window !== 'undefined'
    && 'chrome' in window
    && 'webview' in (window as any).chrome;

if (hasWebView) {
    window.chrome.webview.addEventListener('message', (e: MessageEvent) => {
        const msg = e.data;

        // Response to a request
        if (msg && typeof msg.id === 'number') {
            const p = pending.get(msg.id);
            if (p) {
                pending.delete(msg.id);
                if ('error' in msg) p.reject(new Error(msg.error));
                else p.resolve(msg.result);
            }
        }

        // Native → Frontend event
        if (msg && typeof msg.event === 'string') {
            window.dispatchEvent(new CustomEvent(`ipc:${msg.event}`, { detail: msg.data }));
        }
    });
}

/** Call a native command and await its result. */
export function invoke<T = any>(cmd: string, args: Record<string, any> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
        if (!hasWebView) {
            reject(new Error('Not running in WebView2'));
            return;
        }
        const id = nextId++;
        pending.set(id, { resolve, reject });
        window.chrome.webview.postMessage({ id, cmd, args });
    });
}

/** Listen for a native-pushed event. Returns an unsubscribe function. */
export function on(event: string, handler: (data: any) => void): () => void {
    const listener = ((e: CustomEvent) => handler(e.detail)) as EventListener;
    window.addEventListener(`ipc:${event}`, listener);
    return () => window.removeEventListener(`ipc:${event}`, listener);
}
