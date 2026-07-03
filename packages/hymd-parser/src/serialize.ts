import type { Root } from 'mdast';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import YAML from 'yaml';
import type { HymdDocument, HymdFrontmatter } from './types.js';

const stringifyProcessor = unified()
  .use(remarkStringify, {
    bullet: '-',
    fences: true,
    incrementListMarker: false,
  })
  .use(remarkGfm)
  .use(remarkFrontmatter, ['yaml']);

function ensureFrontmatterNode(ast: Root, frontmatter: HymdFrontmatter): void {
  const yamlText = YAML.stringify(frontmatter).trimEnd();
  const first = ast.children[0];

  if (Object.keys(frontmatter).length === 0) {
    if (first?.type === 'yaml') {
      ast.children.shift();
    }
    return;
  }

  if (first?.type === 'yaml') {
    first.value = yamlText;
    return;
  }

  ast.children.unshift({
    type: 'yaml',
    value: yamlText,
  });
}

/** 将 HymdDocument 序列化为 HyMD 文本 */
export function serializeHymd(doc: HymdDocument): string {
  const ast = structuredClone(doc.ast) as Root;
  ensureFrontmatterNode(ast, doc.frontmatter);
  const result = stringifyProcessor.stringify(ast);
  return typeof result === 'string' ? result : String(result);
}

/** 仅更新 frontmatter 后序列化 */
export function serializeHymdWithFrontmatter(doc: HymdDocument, frontmatter: HymdFrontmatter): string {
  return serializeHymd({ ...doc, frontmatter });
}
