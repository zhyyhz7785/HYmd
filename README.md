# HyMD

HyMD（Hy Markdown）是以 CommonMark/GFM 为基线的 Markdown 超集：正文保持标准 Markdown 习惯，表格/幻灯/排版等 Office 能力以**可拔插 fenced 块**嵌入，在普通 Markdown 工具中可优雅降级为代码块。

## 快速上手

项目根目录 [`.npmrc`](.npmrc) 已配置 **npmmirror** 镜像（`registry.npmmirror.com`），国内可直接 `npm install`。也可临时指定：

```bash
npm install --registry=https://registry.npmmirror.com
# 清华镜像备选：npm install --registry=https://mirrors.tuna.tsinghua.edu.cn/npm/
```

```bash
npm install
npm test
npm run build
```

```typescript
import { parseHymd, serializeHymd } from '@hymd/parser';
import { readFileSync } from 'node:fs';

const text = readFileSync('samples/01-basic-prose.hymd.md', 'utf8');
const doc = parseHymd(text);
console.log(doc.frontmatter.title, doc.blocks.length);
const roundtrip = serializeHymd(doc);
```

## 目录

| 路径 | 说明 |
|---|---|
| [spec/hymd-spec-v0.1.md](spec/hymd-spec-v0.1.md) | 格式规范 v0.1 |
| [spec/schemas/](spec/schemas/) | JSON Schema（frontmatter / 块属性） |
| [packages/hymd-parser/](packages/hymd-parser/) | Parser PoC（解析 + 序列化往返） |
| [samples/](samples/) | 3 个样例 `.hymd.md` |

## M0 验收

- [x] Parser 识别 frontmatter + sheet/slide/layout 块
- [x] parse → serialize → parse 语义等价
- [x] 5 个主流 md 渲染器降级测试（扩展块输出为 `<pre><code>`）

## 手动验证清单（AI 假设验证，M0 不自动化）

1. 用 GPT/Claude 生成含 `sheet` / `slide` 块的 HyMD 片段，检查语法是否符合 [spec/hymd-spec-v0.1.md](spec/hymd-spec-v0.1.md)
2. 用 Typora / VS Code / GitHub 预览打开 `samples/*.hymd.md`，确认扩展块显示为代码块且 prose 正常

## 许可证

MIT
