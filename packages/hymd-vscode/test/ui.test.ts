import { describe, expect, it } from 'vitest';
import { DEFAULT_HYMD_UI_STYLE, type HostToWebviewMessage } from '../src/protocol.js';

describe('HyMD UI protocol', () => {
  it('default ui style is hymd', () => {
    expect(DEFAULT_HYMD_UI_STYLE).toBe('hymd');
  });

  it('init message includes uiStyle', () => {
    const msg: HostToWebviewMessage = {
      type: 'init',
      content: '# hello',
      theme: 'dark',
      uiStyle: 'hymd',
    };
    expect(msg.uiStyle).toBe('hymd');
  });

  it('uiStyleChanged message shape', () => {
    const msg: HostToWebviewMessage = { type: 'uiStyleChanged', uiStyle: 'vscode' };
    expect(msg.uiStyle).toBe('vscode');
  });
});
