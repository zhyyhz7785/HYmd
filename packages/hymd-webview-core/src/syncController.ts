const DEBOUNCE_MS = 220;

export function createSyncController(onEdit: (content: string, version: number) => void) {
  let version = 0;
  let lastContent = '';
  let composing = false;
  let bufferedExternal: string | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let lastExternalVersion = -1;
  let overlayOpen = false;

  return {
    reset(content: string) {
      lastContent = content;
    },
    onLocalEdit(content: string) {
      if (overlayOpen || content === lastContent) return;
      lastContent = content;
      version += 1;
      const v = version;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => onEdit(content, v), DEBOUNCE_MS);
    },
    setComposing(value: boolean) {
      composing = value;
    },
    isComposing() {
      return composing;
    },
    setOverlayOpen(value: boolean) {
      overlayOpen = value;
    },
    isOverlayOpen() {
      return overlayOpen;
    },
    bufferExternal(content: string) {
      bufferedExternal = content;
    },
    takeBufferedExternal() {
      const v = bufferedExternal;
      bufferedExternal = null;
      return v;
    },
    shouldIgnoreExternal(incomingVersion: number) {
      if (incomingVersion === lastExternalVersion) return true;
      lastExternalVersion = incomingVersion;
      return false;
    },
    getVersion() {
      return version;
    },
    bumpAndEmit(content: string) {
      lastContent = content;
      version += 1;
      onEdit(content, version);
    },
  };
}
