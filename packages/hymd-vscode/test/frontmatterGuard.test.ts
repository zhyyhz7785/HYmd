import { describe, expect, it } from 'vitest';
import { joinFrontmatter, splitFrontmatter } from '../src/sync/frontmatterGuard.js';

const FM = `---
title: 结构计算书 — 荷载汇总
theme: engineering-report
page:
  preset: A4
  columns: 2
  margin_mm: [25, 20, 25, 20]
hymd:
  version: "0.1"
---
`;

describe('splitFrontmatter', () => {
  it('splits LF frontmatter and keeps raw text', () => {
    const text = `${FM}\n# 标题\n\n正文。\n`;
    const { frontmatter, body } = splitFrontmatter(text);
    expect(frontmatter).toBe(FM);
    expect(body).toBe('\n# 标题\n\n正文。\n');
  });

  it('splits CRLF frontmatter', () => {
    const text = '---\r\ntitle: x\r\n---\r\n\r\n# T\r\n';
    const { frontmatter, body } = splitFrontmatter(text);
    expect(frontmatter).toBe('---\r\ntitle: x\r\n---\r\n');
    expect(body).toBe('\r\n# T\r\n');
  });

  it('returns empty frontmatter when document has none', () => {
    const text = '# 标题\n\n---\n\n分隔线不是 frontmatter\n';
    const { frontmatter, body } = splitFrontmatter(text);
    expect(frontmatter).toBe('');
    expect(body).toBe(text);
  });

  it('handles empty frontmatter block', () => {
    const text = '---\n---\n# T\n';
    const { frontmatter, body } = splitFrontmatter(text);
    expect(frontmatter).toBe('---\n---\n');
    expect(body).toBe('# T\n');
  });

  it('handles closing fence at EOF without trailing newline', () => {
    const text = '---\ntitle: x\n---';
    const { frontmatter, body } = splitFrontmatter(text);
    expect(frontmatter).toBe('---\ntitle: x\n---');
    expect(body).toBe('');
  });

  it('does not treat unclosed --- as frontmatter', () => {
    const text = '---\ntitle: x\n\n# 没闭合\n';
    const { frontmatter, body } = splitFrontmatter(text);
    expect(frontmatter).toBe('');
    expect(body).toBe(text);
  });

  it('does not treat --- followed by text on the same line as frontmatter', () => {
    const text = '--- not frontmatter\nbody\n';
    expect(splitFrontmatter(text).frontmatter).toBe('');
  });
});

describe('joinFrontmatter', () => {
  it('split→join roundtrips the original document', () => {
    const text = `${FM}\n# 标题\n\n正文。\n`;
    const { frontmatter, body } = splitFrontmatter(text);
    expect(joinFrontmatter(frontmatter, body)).toBe(text);
  });

  it('inserts separator when body lacks a leading newline', () => {
    const joined = joinFrontmatter('---\ntitle: x\n---\n', '# T\n');
    expect(joined).toBe('---\ntitle: x\n---\n\n# T\n');
    // 拼回后仍能再次正确拆分
    const again = splitFrontmatter(joined);
    expect(again.frontmatter).toBe('---\ntitle: x\n---\n');
    expect(again.body).toBe('\n# T\n');
  });

  it('passes body through when frontmatter is empty', () => {
    expect(joinFrontmatter('', '# T\n')).toBe('# T\n');
  });

  it('survives a simulated Milkdown edit cycle without touching frontmatter', () => {
    const original = `${FM}\n# 设计说明\n\n正文段落。\n`;
    const { frontmatter, body } = splitFrontmatter(original);
    // 模拟 Milkdown 编辑正文（frontmatter 从未进入编辑器）
    const editedBody = body.replace('正文段落。', '正文段落（已编辑）。');
    const written = joinFrontmatter(frontmatter, editedBody);
    const reparsed = splitFrontmatter(written);
    expect(reparsed.frontmatter).toBe(FM);
    expect(reparsed.body).toContain('已编辑');
  });
});
