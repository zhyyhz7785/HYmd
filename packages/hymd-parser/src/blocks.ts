import type { BlockTypeDefinition, HymdBlockType } from './types.js';

/** 可拔插块注册表（M0） */
export const BLOCK_REGISTRY: ReadonlyMap<HymdBlockType, BlockTypeDefinition> = new Map([
  ['sheet', { type: 'sheet', idPrefix: 'sheet' }],
  ['slide', { type: 'slide', idPrefix: 'slide' }],
  ['layout', { type: 'layout', idPrefix: 'layout' }],
  ['calc', { type: 'calc', idPrefix: 'calc' }],
]);

export function isHymdBlockType(lang: string | null | undefined): lang is HymdBlockType {
  if (!lang) return false;
  const normalized = lang.trim().split(/\s+/)[0]?.toLowerCase();
  return BLOCK_REGISTRY.has(normalized as HymdBlockType);
}

export function normalizeBlockLang(lang: string): HymdBlockType {
  const first = lang.trim().split(/\s+/)[0]?.toLowerCase();
  if (!first || !BLOCK_REGISTRY.has(first as HymdBlockType)) {
    throw new Error(`Unknown block type in lang: ${lang}`);
  }
  return first as HymdBlockType;
}

/** 解析 info string 属性：`id=load-table theme=default` */
export function parseMetaString(meta: string | null | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!meta?.trim()) return result;

  const pattern = /([a-zA-Z_][\w-]*)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(meta)) !== null) {
    const key = match[1];
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    result[key] = value;
  }
  return result;
}

/** 序列化属性串 */
export function serializeMetaString(attrs: Record<string, string>): string {
  const entries = Object.entries(attrs).filter(([key]) => key !== 'id' || attrs.id);
  return entries
    .filter(([key]) => key !== 'id' || Object.keys(attrs).length === 1)
    .map(([key, value]) => {
      if (key === 'id') {
        if (/[\s"]/.test(value)) return `id="${value.replace(/"/g, '\\"')}"`;
        return `id=${value}`;
      }
      if (/[\s"]/.test(value)) return `${key}="${value.replace(/"/g, '\\"')}"`;
      return `${key}=${value}`;
    })
    .join(' ');
}

/** 序列化块 info string（lang + meta） */
export function serializeBlockInfo(type: HymdBlockType, attrs: Record<string, string>): { lang: string; meta: string | null } {
  const { id, ...rest } = attrs;
  const metaParts: string[] = [];
  if (id) metaParts.push(`id=${id.includes(' ') ? `"${id}"` : id}`);
  for (const [k, v] of Object.entries(rest)) {
    if (k === 'id') continue;
    metaParts.push(v.includes(' ') ? `${k}="${v}"` : `${k}=${v}`);
  }
  return { lang: type, meta: metaParts.length > 0 ? metaParts.join(' ') : null };
}

/** 简单块体校验（M0 不引入 ajv） */
export function validateBlockBody(type: HymdBlockType, body: Record<string, unknown>): string[] {
  const warnings: string[] = [];
  switch (type) {
    case 'sheet':
      if (body.rows !== undefined && typeof body.rows !== 'number') warnings.push('sheet.rows 应为 number');
      if (body.cols !== undefined && typeof body.cols !== 'number') warnings.push('sheet.cols 应为 number');
      break;
    case 'slide':
      if (body.theme !== undefined && typeof body.theme !== 'string') warnings.push('slide.theme 应为 string');
      break;
    case 'layout':
      if (body.width_mm !== undefined && typeof body.width_mm !== 'number') warnings.push('layout.width_mm 应为 number');
      break;
    default:
      break;
  }
  return warnings;
}
