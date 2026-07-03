import { describe, expect, it } from 'vitest';

describe('@hymd/export smoke', () => {
  it('package resolves', async () => {
    const mod = await import('../src/index.js');
    expect(mod).toBeTruthy();
  });
});
