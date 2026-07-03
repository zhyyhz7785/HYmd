import type { Root, RootContent } from 'mdast';
import YAML from 'yaml';
import { isHymdBlockType } from './blocks.js';
import type { HymdBlock, HymdDocument } from './types.js';

function walkNodes(nodes: RootContent[], visitor: (node: RootContent) => void): void {
  for (const node of nodes) {
    visitor(node);
    if ('children' in node && Array.isArray(node.children)) {
      walkNodes(node.children as RootContent[], visitor);
    }
  }
}

function bodyToYaml(body: Record<string, unknown>): string {
  if (Object.keys(body).length === 0) return '';
  return YAML.stringify(body).trimEnd();
}

/** 更新指定 id 的块体 YAML，返回新文档 */
export function updateBlockBody(
  doc: HymdDocument,
  blockId: string,
  body: Record<string, unknown>,
): HymdDocument {
  const target = doc.blocks.find((b) => b.id === blockId);
  if (!target) {
    throw new Error(`Block not found: ${blockId}`);
  }

  const ast = structuredClone(doc.ast) as Root;
  let blockIndex = 0;
  let found = false;

  walkNodes(ast.children, (node) => {
    if (found || node.type !== 'code') return;
    const lang = node.lang ?? '';
    if (!isHymdBlockType(lang)) return;

    const block = doc.blocks[blockIndex++];
    if (block.id === blockId) {
      node.value = bodyToYaml(body);
      found = true;
    }
  });

  if (!found) {
    throw new Error(`Block not found in AST: ${blockId}`);
  }

  const blocks = doc.blocks.map((b) =>
    b.id === blockId ? { ...b, body, bodyRaw: bodyToYaml(body) } : b,
  );

  return { ...doc, ast, blocks };
}

/** 按 id 查找块 */
export function findBlockById(doc: HymdDocument, blockId: string): HymdBlock | undefined {
  return doc.blocks.find((b) => b.id === blockId);
}

/** 列出所有 sheet 块 */
export function listSheetBlocks(doc: HymdDocument): HymdBlock[] {
  return doc.blocks.filter((b) => b.type === 'sheet');
}
