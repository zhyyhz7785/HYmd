import { extractBlockId, isHymdBlockLang } from '../src/protocol.js';

const BLOCK_LABELS: Record<string, string> = {
  sheet: '表格',
  slide: '幻灯',
  layout: '排版',
  calc: '计算',
};

export function applyTheme(theme: 'light' | 'dark' | 'high-contrast'): void {
  document.body.dataset.theme = theme;
}

export function decorateHymdBlocks(root: HTMLElement | null): void {
  if (!root) return;

  root.querySelectorAll('pre code').forEach((codeEl) => {
    const code = codeEl as HTMLElement;
    const classes = Array.from(code.classList);
    const langClass = classes.find((c) => c.startsWith('language-'));
    if (!langClass) return;

    const lang = langClass.replace('language-', '');
    if (!isHymdBlockLang(lang)) return;

    const pre = code.closest('pre');
    if (!pre) return;

    const blockType = lang.trim().split(/\s+/)[0]?.toLowerCase() ?? lang;
    const body = code.textContent ?? '';
    const blockId = extractBlockId(lang, body);

    pre.classList.add('hymd-block-card');
    pre.dataset.hymdBlock = blockType;
    if (blockId) pre.dataset.hymdId = blockId;

    if (pre.querySelector('.hymd-block-badge')) return;

    const badge = document.createElement('div');
    badge.className = 'hymd-block-badge';
    badge.textContent = `${BLOCK_LABELS[blockType] ?? blockType}${blockId ? ` · ${blockId}` : ''}`;
    pre.insertBefore(badge, pre.firstChild);
  });
}
