type SelectTriggerRect = { left: number; top: number; bottom: number; width: number };

export function getSelectMenuPosition(rect: SelectTriggerRect, viewportWidth: number, viewportHeight: number, contentHeight: number) {
  const padding = 12;
  const gap = 4;
  const desiredHeight = Math.min(256, contentHeight);
  const below = Math.max(0, viewportHeight - rect.bottom - padding - gap);
  const above = Math.max(0, rect.top - padding - gap);
  const opensAbove = below < desiredHeight && above > below;
  const maxHeight = Math.min(desiredHeight, opensAbove ? above : below);
  const width = Math.max(0, Math.min(rect.width, viewportWidth - padding * 2));
  return {
    left: Math.max(padding, Math.min(rect.left, viewportWidth - padding - width)),
    top: opensAbove ? Math.max(padding, rect.top - gap - maxHeight) : Math.max(padding, rect.bottom + gap),
    width,
    maxHeight,
    opensAbove
  };
}
