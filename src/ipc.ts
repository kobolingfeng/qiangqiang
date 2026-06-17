// IPC bridge — frontend ↔ native shell communication
// Protocol:
//   Request:  { id, cmd, args }
//   Response: { id, result } | { id, error }
//   Event:    { event, data }

type Pending = {
    resolve: (v: unknown) => void;
    reject: (e: Error) => void;
    timeout?: ReturnType<typeof setTimeout>;
};

type WebViewBridge = {
    postMessage(message: unknown): void;
    addEventListener(type: 'message', listener: (e: MessageEvent<unknown>) => void): void;
};

type IpcMessage = {
    id?: number;
    result?: unknown;
    error?: unknown;
    event?: string;
    data?: unknown;
};

export interface InvokeOptions {
    timeoutMs?: number;
}

const pending = new Map<number, Pending>();
let nextId = 0;

const webview = typeof window !== 'undefined' && 'chrome' in window
    ? (window.chrome?.webview as WebViewBridge | undefined)
    : undefined;

const hasWebView = !!webview
    && typeof webview.addEventListener === 'function'
    && typeof webview.postMessage === 'function';

export const isNativeRuntime = hasWebView;

if (hasWebView) {
    webview.addEventListener('message', (e: MessageEvent<unknown>) => {
        const msg = e.data as IpcMessage | null;
        if (!msg || typeof msg !== 'object') return;

        // Response to a request
        if (msg && typeof msg.id === 'number') {
            const p = pending.get(msg.id);
            if (p) {
                pending.delete(msg.id);
                if (p.timeout) clearTimeout(p.timeout);
                if ('error' in msg) p.reject(new Error(String(msg.error)));
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
export function invoke<T = unknown>(cmd: string, args: object = {}, options: InvokeOptions = {}): Promise<T> {
    return new Promise((resolve, reject) => {
        if (!hasWebView) {
            reject(new Error('Not running in WebView2'));
            return;
        }
        const id = nextId++;
        const timeout = options.timeoutMs && options.timeoutMs > 0
            ? setTimeout(() => {
                pending.delete(id);
                reject(new Error(`IPC command timed out: ${cmd}`));
            }, options.timeoutMs)
            : undefined;

        pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timeout });
        try {
            webview.postMessage({ id, cmd, args });
        } catch (error) {
            pending.delete(id);
            if (timeout) clearTimeout(timeout);
            reject(error instanceof Error ? error : new Error(String(error)));
        }
    });
}

/** Listen for a native-pushed event. Returns an unsubscribe function. */
export function on<T = unknown>(event: string, handler: (data: T) => void): () => void {
    const listener = ((e: CustomEvent<T>) => handler(e.detail)) as EventListener;
    window.addEventListener(`ipc:${event}`, listener);
    return () => window.removeEventListener(`ipc:${event}`, listener);
}
