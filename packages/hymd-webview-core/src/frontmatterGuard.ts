/**
 * Frontmatter 防护：Milkdown 不认识 YAML frontmatter。
 * 宿主剥离 frontmatter，webview 只编辑正文，写回时拼回。
 */

export interface FrontmatterSplit {
  frontmatter: string;
  body: string;
}

export function splitFrontmatter(text: string): FrontmatterSplit {
  if (!text.startsWith('---')) return { frontmatter: '', body: text };

  const firstLineEnd = text.indexOf('\n');
  if (firstLineEnd === -1) return { frontmatter: '', body: text };
  if (text.slice(0, firstLineEnd).replace(/\r$/, '') !== '---') {
    return { frontmatter: '', body: text };
  }

  let searchFrom = firstLineEnd + 1;
  while (searchFrom <= text.length) {
    const lineEnd = text.indexOf('\n', searchFrom);
    const rawLine = lineEnd === -1 ? text.slice(searchFrom) : text.slice(searchFrom, lineEnd);
    if (rawLine.replace(/\r$/, '') === '---') {
      const end = lineEnd === -1 ? text.length : lineEnd + 1;
      return { frontmatter: text.slice(0, end), body: text.slice(end) };
    }
    if (lineEnd === -1) break;
    searchFrom = lineEnd + 1;
  }
  return { frontmatter: '', body: text };
}

export function joinFrontmatter(frontmatter: string, body: string): string {
  if (!frontmatter) return body;
  const fm = frontmatter.endsWith('\n') ? frontmatter : `${frontmatter}\n`;
  if (body.length === 0) return fm;
  return body.startsWith('\n') || body.startsWith('\r\n') ? fm + body : `${fm}\n${body}`;
}
