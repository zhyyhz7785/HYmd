/**
 * 主题注册表：frontmatter `theme` → CSS 变量集。
 * 变量注入 .hymd-paper 作用域，正文样式（paper.css）全部引用这些变量。
 */

export interface LayoutTheme {
  name: string;
  /** CSS 自定义属性（不含 -- 前缀） */
  variables: Record<string, string>;
}

const SANS_CJK =
  "'Segoe UI','Microsoft YaHei','PingFang SC','Noto Sans CJK SC',sans-serif";
const SERIF_CJK = "'Times New Roman','SimSun','Songti SC','Noto Serif CJK SC',serif";
const MONO = "Consolas,'Courier New',monospace";

export const THEMES: Readonly<Record<string, LayoutTheme>> = {
  default: {
    name: 'default',
    variables: {
      'font-family': SANS_CJK,
      'font-family-mono': MONO,
      'font-size': '3.5mm',
      'line-height': '1.6',
      'text-color': '#1f2328',
      'paper-bg': '#ffffff',
      'heading-color': '#1f2328',
      'heading-border': '#d0d7de',
      'link-color': '#0969da',
      'quote-border': '#6e7781',
      'quote-bg': '#f6f8fa',
      'quote-color': '#57606a',
      'code-bg': '#f0f3f6',
      'code-color': '#24292f',
      'pre-bg': '#f6f8fa',
      'pre-border': '#d0d7de',
      'table-border': '#d0d7de',
      'table-head-bg': '#f6f8fa',
      'table-stripe-bg': '#f8fafc',
    },
  },
  'github-light': {
    name: 'github-light',
    variables: {
      'font-family': SANS_CJK,
      'font-family-mono': MONO,
      'font-size': '3.2mm',
      'line-height': '1.5',
      'text-color': '#24292f',
      'paper-bg': '#ffffff',
      'heading-color': '#24292f',
      'heading-border': '#d8dee4',
      'link-color': '#0969da',
      'quote-border': '#d0d7de',
      'quote-bg': '#ffffff',
      'quote-color': '#57606a',
      'code-bg': '#eff1f3',
      'code-color': '#24292f',
      'pre-bg': '#f6f8fa',
      'pre-border': '#d8dee4',
      'table-border': '#d8dee4',
      'table-head-bg': '#f6f8fa',
      'table-stripe-bg': '#ffffff',
    },
  },
  'engineering-report': {
    name: 'engineering-report',
    variables: {
      'font-family': SERIF_CJK,
      'font-family-mono': MONO,
      'font-size': '3.5mm',
      'line-height': '1.55',
      'text-color': '#111111',
      'paper-bg': '#ffffff',
      'heading-color': '#000000',
      'heading-border': '#333333',
      'link-color': '#003d99',
      'quote-border': '#555555',
      'quote-bg': '#f5f5f5',
      'quote-color': '#333333',
      'code-bg': '#f0f0f0',
      'code-color': '#222222',
      'pre-bg': '#f7f7f7',
      'pre-border': '#bbbbbb',
      'table-border': '#333333',
      'table-head-bg': '#eeeeee',
      'table-stripe-bg': '#fafafa',
    },
  },
};

/** 按名称取主题；未知名称回退 default */
export function resolveTheme(name: unknown): LayoutTheme {
  if (typeof name === 'string') {
    const key = name.trim().toLowerCase();
    const found = Object.keys(THEMES).find((k) => k.toLowerCase() === key);
    if (found) return THEMES[found];
  }
  return THEMES.default;
}

/**
 * 生成主题 CSS 变量声明文本（不含选择器包裹）。
 * `font-size` 等 mm 口径变量按 scale 换算为 px。
 */
export function themeToCssVariables(theme: LayoutTheme, scale: number): string {
  const decls: string[] = [];
  for (const [key, value] of Object.entries(theme.variables)) {
    const mmMatch = /^([\d.]+)mm$/.exec(value);
    if (mmMatch) {
      decls.push(`--hymd-${key}:${(Number(mmMatch[1]) * scale).toFixed(3)}px;`);
    } else {
      decls.push(`--hymd-${key}:${value};`);
    }
  }
  return decls.join('');
}
