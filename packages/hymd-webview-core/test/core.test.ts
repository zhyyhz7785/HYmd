import { describe, expect, it } from 'vitest';
import { splitFrontmatter, joinFrontmatter, extractBlockId } from '../src/index.js';

describe('@hymd/webview-core', () => {
  it('splitFrontmatter', () => {
    const text = '---\ntitle: t\n---\n\n# hi';
    const split = splitFrontmatter(text);
    expect(split.frontmatter).toContain('title: t');
    expect(split.body.trim()).toBe('# hi');
  });

  it('joinFrontmatter roundtrip', () => {
    const text = '---\na: 1\n---\n\nbody';
    const split = splitFrontmatter(text);
    expect(joinFrontmatter(split.frontmatter, split.body)).toBe(text);
  });

  it('extractBlockId from body', () => {
    expect(extractBlockId('sheet', 'id: load-table\nrows: 5')).toBe('load-table');
  });
});
