---
title: 结构计算书 — 荷载汇总
theme: engineering-report
page:
  preset: A4
  columns: 2
  margin_mm: [25, 20, 25, 20]
hymd:
  version: "0.1"
---

# 设计说明

本工程采用 HyMD 混排：**正文**为标准 Markdown，**表格计算**以 `sheet` 块嵌入。

## 荷载汇总表

下列表格由 Univer Sheets 引擎渲染（M1）；在普通 Markdown 预览中降级为代码块。

```sheet id=load-table
rows: 20
cols: 8
snapshot: ./02-report-with-sheet.hy.assets/load-table.univer.json
```

## 结论

* 恒载按规范取值

* 活载按用途分类

| 项目   | 数值   |
| ---- | ---- |
| 安全系数 | 1.35 |

```layout
width_mm: 160
height_mm: 40
anchor: column-1
```

