interface Chrome {
    webview: {
        postMessage(message: any): void;
        addEventListener(type: 'message', listener: (e: MessageEvent) => void): void;
        removeEventListener(type: 'message', listener: (e: MessageEvent) => void): void;
    };
}

interface Window {
    chrome: Chrome;
}
