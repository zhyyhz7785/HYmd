---
title: 技术汇报 — 混排示例
theme: default
hymd:
  version: "0.1"
---

# 技术汇报

正文与幻灯块可混排在同一文档中。

## 背景

HyMD 将 Marp 兼容幻灯作为 `slide` 块引用；无 HyMD 渲染器时显示为 fenced code。

```slide id=intro-deck theme=default
source: ./03-slide-mixed.hymd.assets/intro-deck.marp.md
```

## 讨论

1. 第一阶段：格式规范（M0）
2. 第二阶段：表格块（M1）
3. 第三阶段：编辑器壳（M2）

---

附录：普通代码块不受影响。

```javascript
console.log('not a hymd block');
```
