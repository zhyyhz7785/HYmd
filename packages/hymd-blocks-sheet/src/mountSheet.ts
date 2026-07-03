import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreZhCN from '@univerjs/preset-sheets-core/locales/zh-CN';
import { createUniver, LocaleType, mergeLocales, type Univer } from '@univerjs/presets';
import type { UniverWorkbookSnapshot } from './snapshotUtils.js';
import { normalizeSnapshot } from './snapshotUtils.js';

import '@univerjs/preset-sheets-core/lib/index.css';

export interface SheetMountHandle {
  dispose: () => void;
  save: () => UniverWorkbookSnapshot | null;
}

export interface SheetEditorOptions {
  onSave?: (data: UniverWorkbookSnapshot) => void;
}

function createUniverInstance(
  container: HTMLElement,
  snapshot: UniverWorkbookSnapshot,
  mode: 'preview' | 'editor',
): { univer: Univer; save: () => UniverWorkbookSnapshot | null } {
  const data = normalizeSnapshot(snapshot);
  const isPreview = mode === 'preview';

  const { univer, univerAPI } = createUniver({
    locale: LocaleType.ZH_CN,
    locales: {
      [LocaleType.ZH_CN]: mergeLocales(UniverPresetSheetsCoreZhCN),
    },
    presets: [
      UniverSheetsCorePreset({
        container,
        header: !isPreview,
        toolbar: !isPreview,
        footer: isPreview ? false : undefined,
        ribbonType: isPreview ? 'simple' : 'classic',
      }),
    ],
  });

  const workbook = univerAPI.createWorkbook(data as Parameters<typeof univerAPI.createWorkbook>[0]);

  if (isPreview) {
    void workbook.getWorkbookPermission().setReadOnly();
  }

  return {
    univer,
    save: () => {
      const wb = univerAPI.getActiveWorkbook();
      if (!wb) return null;
      return wb.save() as unknown as UniverWorkbookSnapshot;
    },
  };
}

/** 只读预览挂载 */
export function mountSheetPreview(
  container: HTMLElement,
  snapshot: UniverWorkbookSnapshot,
): SheetMountHandle {
  container.innerHTML = '';
  container.setAttribute('contenteditable', 'false');
  container.classList.add('hymd-sheet-preview-root');

  const { univer, save } = createUniverInstance(container, snapshot, 'preview');

  return {
    save,
    dispose: () => {
      univer.dispose();
      container.innerHTML = '';
    },
  };
}

/** 全功能编辑器挂载 */
export function mountSheetEditor(
  container: HTMLElement,
  snapshot: UniverWorkbookSnapshot,
  _options?: SheetEditorOptions,
): SheetMountHandle {
  container.innerHTML = '';
  container.classList.add('hymd-sheet-editor-root');

  const { univer, save } = createUniverInstance(container, snapshot, 'editor');

  return {
    save,
    dispose: () => {
      univer.dispose();
      container.innerHTML = '';
    },
  };
}
