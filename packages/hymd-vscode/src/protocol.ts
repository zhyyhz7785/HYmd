/** Host → Webview */
export type HostToWebviewMessage =
  | { type: 'init'; content: string; theme: 'light' | 'dark' | 'high-contrast' }
  | { type: 'externalUpdate'; content: string; version: number }
  | { type: 'themeChanged'; theme: 'light' | 'dark' | 'high-contrast' };

/** Webview → Host */
export type WebviewToHostMessage =
  | { type: 'ready' }
  | { type: 'edit'; content: string; version: number }
  | { type: 'log'; message: string };

export const HymdBlockTypes = ['sheet', 'slide', 'layout', 'calc'] as const;
export type HymdBlockTypeName = (typeof HymdBlockTypes)[number];

export function isHymdBlockLang(lang: string | undefined | null): lang is HymdBlockTypeName {
  if (!lang) return false;
  const first = lang.trim().split(/\s+/)[0]?.toLowerCase();
  return (HymdBlockTypes as readonly string[]).includes(first ?? '');
}

export function extractBlockId(lang: string, body: string): string | undefined {
  const metaPart = lang.trim().split(/\s+/).slice(1).join(' ');
  const idMatch = /(?:^|\s)id=(?:\"([^\"]+)\"|'([^']+)'|(\S+))/.exec(metaPart);
  if (idMatch) return idMatch[1] ?? idMatch[2] ?? idMatch[3];
  const bodyMatch = /^id:\s*(.+)$/m.exec(body);
  return bodyMatch?.[1]?.trim();
}
