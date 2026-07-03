import type { Root } from 'mdast';

/** 注册的 HyMD 块类型 */
export type HymdBlockType = 'sheet' | 'slide' | 'layout' | 'calc';

/** 解析后的扩展块 */
export interface HymdBlock {
  type: HymdBlockType;
  id: string;
  /** info string 中的属性（key=value） */
  attrs: Record<string, string>;
  /** 块体 YAML 解析结果 */
  body: Record<string, unknown>;
  /** 块体原始 YAML 文本（用于往返） */
  bodyRaw: string;
  /** mdast code 节点位置 */
  position?: {
    start: { line: number; column: number; offset?: number };
    end: { line: number; column: number; offset?: number };
  };
}

/** Frontmatter 解析结果 */
export type HymdFrontmatter = Record<string, unknown>;

/** parseHymd 返回值 */
export interface HymdDocument {
  frontmatter: HymdFrontmatter;
  blocks: HymdBlock[];
  /** 完整 mdast（含 frontmatter yaml 节点与 code 块） */
  ast: Root;
  /** 原始输入文本 */
  raw: string;
}

/** 块注册表项 */
export interface BlockTypeDefinition {
  type: HymdBlockType;
  /** 默认 id 前缀 */
  idPrefix: string;
}
