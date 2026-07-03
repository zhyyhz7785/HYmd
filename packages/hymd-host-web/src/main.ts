import { createHymdEditor } from '@hymd/webview-core';
import type { HostToWebviewMessage, WebviewToHostMessage } from '@hymd/webview-core';

declare global {
  interface Window {
    chrome?: {
      webview?: {
        postMessage(message: string): void;
        addEventListener(type: 'message', listener: (event: MessageEvent<string>) => void): void;
      };
    };
  }
}

function postToHost(msg: WebviewToHostMessage): void {
  window.chrome?.webview?.postMessage(JSON.stringify(msg));
}

const editor = createHymdEditor({
  editorRoot: document.getElementById('editor-root')!,
  overlayRoot: document.getElementById('sheet-overlay-root')!,
  sheetMode: 'client',
  bridge: {
    postMessage(msg) {
      postToHost(msg);
    },
  },
});

window.chrome?.webview?.addEventListener('message', (event) => {
  try {
    const msg = JSON.parse(event.data) as HostToWebviewMessage;
    void editor.handleHostMessage(msg);
  } catch (e) {
    console.error('[hymd-host-web]', e);
  }
});

postToHost({ type: 'ready' });
