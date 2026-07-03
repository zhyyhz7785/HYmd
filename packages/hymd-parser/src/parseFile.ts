import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHymd } from './parse.js';
import type { HymdDocument } from './types.js';

/** 从文件路径解析 HyMD */
export function parseHymdFile(filePath: string): HymdDocument {
  const text = readFileSync(filePath, 'utf8');
  return parseHymd(text);
}

/** 解析仓库内样例（测试辅助） */
export function parseSample(name: string): HymdDocument {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, '..', '..', '..');
  const filePath = join(root, 'samples', name);
  return parseHymdFile(filePath);
}
