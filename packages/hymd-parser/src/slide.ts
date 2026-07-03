import type { HymdBlock } from './types.js';

export type SlideSource =
  | { kind: 'external'; path: string }
  | { kind: 'inline'; markdown: string }
  | { kind: 'empty' };

/** 解析 slide 块的 Marp 源来源 */
export function resolveSlideSource(block: HymdBlock): SlideSource {
  if (block.type !== 'slide') {
    throw new Error(`resolveSlideSource: expected slide block, got ${block.type}`);
  }

  const sourcePath = block.body.source;
  if (typeof sourcePath === 'string' && sourcePath.trim()) {
    return { kind: 'external', path: sourcePath.trim() };
  }

  const slides = block.body.slides;
  if (
    Array.isArray(slides) &&
    slides.length > 0 &&
    slides.every((s) => typeof s === 'string')
  ) {
    return { kind: 'inline', markdown: (slides as string[]).join('\n\n---\n\n') };
  }

  return { kind: 'empty' };
}

/** slide 块主题：info string 属性优先，块体 theme 兜底 */
export function slideTheme(block: HymdBlock): string | undefined {
  if (typeof block.attrs.theme === 'string' && block.attrs.theme) return block.attrs.theme;
  if (typeof block.body.theme === 'string' && block.body.theme) return block.body.theme;
  return undefined;
}
