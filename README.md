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

const text = readFileSync('samples/01-basic-prose.hy.md', 'utf8');
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
| [samples/](samples/) | 3 个样例 `.hy.md` |

## M0 验收

- [x] Parser 识别 frontmatter + sheet/slide/layout 块
- [x] parse → serialize → parse 语义等价
- [x] 5 个主流 md 渲染器降级测试（扩展块输出为 `<pre><code>`）

## M1 — Sheet 块（Univer）

| 组件 | 路径 | 说明 |
|---|---|---|
| Sheet 引擎封装 | [packages/hymd-blocks-sheet](packages/hymd-blocks-sheet) | Univer 只读预览 + 编辑器挂载 |
| 块体 embed/export | `hymd.sheet.embedSnapshot` / `exportSnapshot` | 外置 assets ↔ 内嵌 `data` |
| 交互 | WYSIWYG 内 sheet 卡片 | 懒加载只读预览 → 「编辑」全屏覆盖层 |

### 手动验收（F5）

1. 打开 `samples/02-report-with-sheet.hy.md`
2. sheet 卡片显示只读 Univer 预览（含公式列）
3. 点击「编辑」→ 全屏覆盖层 → 修改单元格/公式 → 保存
4. 检查 `samples/02-report-with-sheet.hy.assets/load-table.univer.json` 中 `f` 字段保留
5. 命令面板：`HyMD: 嵌入 Sheet Snapshot` / `导出 Sheet Snapshot` 往返

## M1 — VS Code 扩展 + HYmd Code Fork

| 组件 | 路径 | 说明 |
|---|---|---|
| VS Code 扩展 | [packages/hymd-vscode](packages/hymd-vscode) | Milkdown Crepe WYSIWYG + HyMD 块卡片 |
| Fork 同步 | `npm run sync:fork` | 产物 → `../hymd-code/extensions/hymd-editor` |
| HYmd Code | `../hymd-code` | Code-OSS 1.99.3 fork，仅改 product.json + 内置扩展 |

### 扩展开发（F5，无需 fork 构建）

```powershell
npm run build:vscode
# 在 Cursor/VS Code 打开 HYmd 仓库，F5 启动 Extension Development Host
# 打开 samples/*.hy.md 即进入 WYSIWYG
```

### HYmd Code 构建

见 [../hymd-code/README-HYMD.md](../hymd-code/README-HYMD.md)（需 Node 20.18.2 + `npm ci && npm run compile`）

## 手动验证清单（AI 假设验证，M0 不自动化）

1. 用 GPT/Claude 生成含 `sheet` / `slide` 块的 HyMD 片段，检查语法是否符合 [spec/hymd-spec-v0.1.md](spec/hymd-spec-v0.1.md)
2. 用 Typora / VS Code / GitHub 预览打开 `samples/*.hy.md`，确认扩展块显示为代码块且 prose 正常

## 许可证

MIT
