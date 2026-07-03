import { describe, expect, it } from 'vitest';
import { THEMES, resolveTheme, themeToCssVariables } from '../src/themes.js';

describe('resolveTheme', () => {
  it('returns registered themes by name (case-insensitive)', () => {
    expect(resolveTheme('engineering-report').name).toBe('engineering-report');
    expect(resolveTheme('GitHub-Light').name).toBe('github-light');
    expect(resolveTheme('default').name).toBe('default');
  });

  it('falls back to default for unknown or non-string', () => {
    expect(resolveTheme('nope').name).toBe('default');
    expect(resolveTheme(undefined).name).toBe('default');
    expect(resolveTheme(42).name).toBe('default');
  });

  it('registry has 3 built-in themes', () => {
    expect(Object.keys(THEMES).sort()).toEqual(['default', 'engineering-report', 'github-light']);
  });
});

describe('themeToCssVariables', () => {
  it('converts mm values to px by scale and prefixes --hymd-', () => {
    const css = themeToCssVariables(THEMES.default, 4);
    // default font-size 3.5mm × 4 = 14px
    expect(css).toContain('--hymd-font-size:14.000px;');
    expect(css).toContain('--hymd-text-color:#1f2328;');
  });

  it('keeps non-mm values untouched', () => {
    const css = themeToCssVariables(THEMES['engineering-report'], 2);
    expect(css).toContain('--hymd-line-height:1.55;');
    expect(css).toContain('--hymd-font-size:7.000px;');
  });
});
