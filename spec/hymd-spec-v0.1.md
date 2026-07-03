# HyMD 格式规范 v0.1

> 版本：`hymd.version: "0.1"`  
> 状态：M0 PoC  
> 基线：CommonMark + GitHub Flavored Markdown (GFM)

## 1. 设计目标

1. **保持 Markdown 习惯**：正文使用标准 CommonMark/GFM 语法，零迁移成本。
2. **可拔插扩展块**：表格、幻灯、排版等能力以 fenced code block 嵌入，引擎可替换。
3. **优雅降级**：任意 Markdown 渲染器将扩展块显示为代码块，内容仍人类可读。
4. **AI 易操控**：单文件纯文本，块属性为声明式 YAML，AI 可直接读写。

## 2. 文件命名

- 推荐扩展名：**`.hymd.md`**
- 理由：`.md` 后缀保证 Typora、VS Code、GitHub 等工具直接识别为 Markdown。

## 3. Frontmatter

文档可选 YAML frontmatter，位于文件开头，以 `---` 包裹。

### 3.1 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | string | 否 | 文档标题 |
| `theme` | string | 否 | 主题名，如 `engineering-report`、`github-light` |
| `page.preset` | string | 否 | 纸张预设：`A0`–`A4`、`Letter` |
| `page.columns` | integer | 否 | 分栏数，默认 1 |
| `page.margin_mm` | [number, number, number, number] | 否 | 上右下左边距（mm） |
| `hymd.version` | string | 否 | 格式版本，当前为 `"0.1"` |

### 3.2 示例

```yaml
---
title: 结构计算书
theme: engineering-report
page:
  preset: A4
  columns: 2
  margin_mm: [25, 20, 25, 20]
hymd:
  version: "0.1"
---
```

JSON Schema：[`schemas/frontmatter.schema.json`](schemas/frontmatter.schema.json)

## 4. 扩展块语法

扩展块使用 **围栏代码块（fenced code block）** 表示。

### 4.1 结构

````
```<块类型> [属性串]
<YAML 属性体（可选）>
```
````

- **块类型**：注册表中的类型名，如 `sheet`、`slide`、`layout`、`calc`。
- **属性串**：空格分隔的 `key=value` 对，写在 info string 中（与 lang 同一行）。
- **块体**：可选 YAML 对象；复杂负载（如 Univer snapshot）可引用外置文件。

### 4.2 属性串解析规则

- 格式：`key=value`，多个属性以空格分隔。
- `value` 若含空格，用双引号包裹：`id="load table"`。
- 常用属性：`id`（块唯一标识，同文档内建议唯一）。

### 4.3 块体 YAML

块体为 YAML 映射（mapping），键值由块类型 schema 约束。空块体 `{}` 可省略（仅保留属性串）。

### 4.4 示例

````markdown
```sheet id=load-table
rows: 20
cols: 8
snapshot: ./02-report-with-sheet.hymd.assets/load-table.univer.json
```

```slide id=intro-deck theme=default
source: ./03-slide-mixed.hymd.assets/intro-deck.marp.md
```

```layout id=figure-1
width_mm: 120
height_mm: 80
anchor: column-1
```
````

## 5. 块类型注册表（v0.1）

| 类型 | 用途 | Schema | 降级显示 |
|---|---|---|---|
| `sheet` | 表格/计算（Univer Sheets snapshot） | `block-sheet.schema.json` | 代码块，含 rows/cols/snapshot 摘要 |
| `slide` | 幻灯（Marp 兼容子文档） | `block-slide.schema.json` | 代码块，含 theme/source 摘要 |
| `layout` | 排版占位（分页/尺寸） | `block-layout.schema.json` | 代码块 |
| `calc` | 轻量 md 表公式（M1+ 预留） | 同 sheet 简化 | 代码块 |

未知块类型：**不得删除**；HyMD 感知渲染器按 code fence 降级；普通渲染器原样显示。

## 6. 块 id 规则

- 格式：`[a-z][a-z0-9-]*`（小写字母开头，仅小写字母、数字、连字符）。
- 同一文档内 `id` 应唯一；解析器 M0 仅警告不阻断。
- 无 `id` 时解析器可生成 `sheet-1`、`slide-2` 等序号 id（仅内存，序列化时写回）。

## 7. 外置 assets 约定

- 目录名：`<文件名>.assets/`（与 `.hymd.md` 同目录）。
- 示例：`02-report-with-sheet.hymd.md` → `02-report-with-sheet.hymd.assets/load-table.univer.json`
- M0：规范定义 + 样例引用；读写实现推迟至 M1。
- 块体 `snapshot` / `source` 字段使用相对路径，相对于 `.hymd.md` 文件。

## 8. 降级规则

1. 任何**不识别 HyMD 块类型**的 Markdown 渲染器 MUST 将扩展块渲染为 `<pre><code>`（或等价代码块 UI）。
2. Prose 段落 MUST 按 CommonMark/GFM 正常渲染。
3. Frontmatter 在多数渲染器中不显示（YAML 被忽略或显示为原文），不影响阅读。
4. HyMD 感知工具 MAY 替换扩展块为交互 UI（表格编辑器、幻灯预览等）。

## 9. 序列化与往返

- HyMD Parser MUST 支持 `parse → serialize → parse` 语义等价。
- 块在 AST 中保留原始 `lang`、`meta`（属性串）、`value`（块体）；序列化时还原为相同 fenced block。
- Frontmatter 序列化为 YAML，键顺序允许变化，语义等价即可。

## 10. 与标准 Markdown 的关系

| 特性 | HyMD | GFM |
|---|---|---|
| 标题、列表、链接 | 相同 | 相同 |
| GFM 表格 | 相同（轻量表） | 相同 |
| 扩展块 | fenced + 注册类型 | 无 |
| 公式 `$...$` | 可选（渲染器支持） | 扩展 |

**禁止**在正文中引入 Typst/AsciiDoc 专有语法；扩展能力仅通过注册块类型添加。

## 11. 版本演进

- `hymd.version` 主版本变更表示不兼容语法变更。
- v0.1 → v0.2 预计：assets 读写、`calc` 块、块间引用。

## 12. 参考实现

- Parser：`packages/hymd-parser`
- 样例：`samples/*.hymd.md`
