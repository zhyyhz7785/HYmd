import { describe, expect, it } from 'vitest';
import {
  DocumentSyncState,
  normalizeMarkdown,
} from '../src/sync/documentSync.js';
import { parseHymd } from '@hymd/parser';
import { extractBlockId, isHymdBlockLang } from '../src/protocol.js';

describe('DocumentSyncState', () => {
  it('ignores echo from pending host write', () => {
    const state = new DocumentSyncState('hello');
    expect(state.onWebviewEdit('hello world', 1)).toBe(true);
    expect(state.shouldApplyExternal('hello world', 2)).toBe(false);
    state.onHostApplied(1);
    expect(state.shouldApplyExternal('hello world', 3)).toBe(false);
  });

  it('applies external change after host applied', () => {
    const state = new DocumentSyncState('a');
    state.onWebviewEdit('b', 1);
    state.onHostApplied(1);
    expect(state.shouldApplyExternal('c', 2)).toBe(true);
  });
});

describe('normalizeMarkdown', () => {
  it('normalizes CRLF', () => {
    expect(normalizeMarkdown('a\r\nb')).toBe('a\nb');
  });
});

describe('HyMD block protocol', () => {
  it('detects block langs', () => {
    expect(isHymdBlockLang('sheet')).toBe(true);
    expect(isHymdBlockLang('sheet id=foo')).toBe(true);
    expect(isHymdBlockLang('javascript')).toBe(false);
  });

  it('extracts block id from meta', () => {
    expect(extractBlockId('sheet id=load-table', '')).toBe('load-table');
  });
});

describe('parseHymd integration', () => {
  it('parses sheet block from sample markdown', () => {
    const md = '```sheet id=t1\nrows: 3\ncols: 2\n```';
    const blocks = parseHymd(md).blocks;
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('sheet');
    expect(blocks[0].id).toBe('t1');
  });
});
