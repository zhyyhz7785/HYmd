// 临时脚本：检查样例 03 是否保持 canonical 形态（frontmatter --- 开头 + slide 围栏含 id 属性）
import { readFileSync, statSync } from 'node:fs';

const p = 'samples/03-slide-mixed.hy.md';
const fence = '`'.repeat(3);
const t = readFileSync(p, 'utf8');
console.log('mtime:', statSync(p).mtime.toISOString());
console.log('startsWithDashes:', t.startsWith('---'));
console.log('fenceWithMeta:', t.includes(`${fence}slide id=intro-deck theme=default`));
