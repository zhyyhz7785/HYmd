/**
 * 文档同步状态机：追踪 webview/host 版本，避免回声。
 */
export class DocumentSyncState {
  private pendingHostVersion = 0;
  private lastAppliedWebviewVersion = 0;
  private lastKnownContent = '';

  constructor(initialContent: string) {
    this.lastKnownContent = initialContent;
  }

  /** webview 发起编辑 */
  onWebviewEdit(content: string, version: number): boolean {
    if (version <= this.lastAppliedWebviewVersion) return false;
    this.lastAppliedWebviewVersion = version;
    this.lastKnownContent = content;
    this.pendingHostVersion = version;
    return true;
  }

  /** host 写回文档后确认 */
  onHostApplied(version: number): void {
    if (version === this.pendingHostVersion) {
      this.pendingHostVersion = 0;
    }
  }

  /** 外部文档变更（非自身写回） */
  shouldApplyExternal(content: string, documentVersion: number): boolean {
    if (this.pendingHostVersion !== 0) return false;
    if (content === this.lastKnownContent) return false;
    this.lastKnownContent = content;
    this.lastAppliedWebviewVersion = documentVersion;
    return true;
  }

  getLastKnownContent(): string {
    return this.lastKnownContent;
  }
}

/** 计算单行最小替换范围（M0：整文档替换；后续可改 diff） */
export function fullDocumentReplaceRange(lineCount: number): {
  start: { line: number; character: number };
  end: { line: number; character: number };
} {
  return {
    start: { line: 0, character: 0 },
    end: { line: Math.max(0, lineCount - 1), character: Number.MAX_SAFE_INTEGER },
  };
}

/** 归一化 Markdown 换行，便于比较 */
export function normalizeMarkdown(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
