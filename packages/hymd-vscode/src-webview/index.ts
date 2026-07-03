import { createHymdEditor } from '@hymd/webview-core';
import type { HostToWebviewMessage, WebviewToHostMessage } from '../src/protocol.js';

declare function acquireVsCodeApi(): {
  postMessage(message: WebviewToHostMessage): void;
};

const vscode = acquireVsCodeApi();

const editor = createHymdEditor({
  editorRoot: document.getElementById('editor-root')!,
  overlayRoot: document.getElementById('sheet-overlay-root')!,
  sheetMode: 'host',
  bridge: {
    postMessage(msg) {
      vscode.postMessage(msg);
    },
  },
});

window.addEventListener('message', (event) => {
  const msg = event.data as HostToWebviewMessage;
  void editor.handleHostMessage(msg);
});

vscode.postMessage({ type: 'ready' });
