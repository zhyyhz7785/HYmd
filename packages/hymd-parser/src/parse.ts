import type { Root, RootContent } from 'mdast';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import YAML from 'yaml';
import {
  isHymdBlockType,
  normalizeBlockLang,
  parseMetaString,
  validateBlockBody,
} from './blocks.js';
import type { HymdBlock, HymdDocument, HymdFrontmatter } from './types.js';

function walkNodes(nodes: RootContent[], visitor: (node: RootContent) => void): void {
  for (const node of nodes) {
    visitor(node);
    if ('children' in node && Array.isArray(node.children)) {
      walkNodes(node.children as RootContent[], visitor);
    }
  }
}

function parseYamlMapping(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) return {};
  const parsed = YAML.parse(trimmed);
  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { _raw: parsed };
  }
  return parsed as Record<string, unknown>;
}

function extractFrontmatter(ast: Root): HymdFrontmatter {
  const first = ast.children[0];
  if (first?.type === 'yaml') {
    try {
      const parsed = YAML.parse(first.value);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as HymdFrontmatter)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function extractBlocks(ast: Root): HymdBlock[] {
  const blocks: HymdBlock[] = [];
  const counters: Record<string, number> = {};

  walkNodes(ast.children, (node) => {
    if (node.type !== 'code') return;
    const lang = node.lang ?? '';
    if (!isHymdBlockType(lang)) return;

    const blockType = normalizeBlockLang(lang);
    const langParts = lang.trim().split(/\s+/).slice(1);
    const metaCombined = [...langParts, node.meta ?? ''].filter(Boolean).join(' ');
    const attrs = parseMetaString(metaCombined);
    const bodyRaw = node.value ?? '';
    const body = parseYamlMapping(bodyRaw);
    const bodyId = typeof body.id === 'string' ? body.id : undefined;

    const prefix = blockType;
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    const id = attrs.id ?? bodyId ?? `${prefix}-${counters[prefix]}`;

    const block: HymdBlock = {
      type: blockType,
      id,
      attrs: { ...attrs, id },
      body,
      bodyRaw,
      position: node.position
        ? {
            start: { ...node.position.start },
            end: { ...node.position.end },
          }
        : undefined,
    };

    validateBlockBody(blockType, body);
    blocks.push(block);
  });

  return blocks;
}

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ['yaml']);

/** 解析 HyMD 文本为结构化文档 */
export function parseHymd(text: string): HymdDocument {
  const ast = processor.parse(text) as Root;
  const frontmatter = extractFrontmatter(ast);
  const blocks = extractBlocks(ast);

  return {
    frontmatter,
    blocks,
    ast,
    raw: text,
  };
}
