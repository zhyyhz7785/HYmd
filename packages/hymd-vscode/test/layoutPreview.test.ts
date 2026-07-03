import { describe, expect, it } from 'vitest';
import type { LayoutHostToWebviewMessage, LayoutWebviewToHostMessage } from '../src/protocol.js';

describe('layout preview protocol', () => {
  it('layoutInit message shape', () => {
    const msg: LayoutHostToWebviewMessage = { type: 'layoutInit', content: '# T\n' };
    expect(msg.type).toBe('layoutInit');
  });

  it('layoutStats message shape', () => {
    const msg: LayoutWebviewToHostMessage = {
      type: 'layoutStats',
      page: 1,
      totalPages: 3,
      geoDeltaMm: 0.5,
    };
    expect(msg.geoDeltaMm).toBeLessThanOrEqual(2);
  });
});
