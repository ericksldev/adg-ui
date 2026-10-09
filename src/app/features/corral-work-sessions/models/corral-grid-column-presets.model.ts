export interface GridColumnPresetEntry {
  value: string;
  label: string;
  /** Applied automatically when a scanned animal has an empty cell for this column. */
  isDefault?: boolean;
}

export type StepGridColumnPresets = Record<string, GridColumnPresetEntry[]>;

export function createEmptyStepGridColumnPresets(): StepGridColumnPresets {
  return {};
}

export function normalizeStepGridColumnPresets(raw: unknown): StepGridColumnPresets {
  if (!raw || typeof raw !== 'object') {
    return createEmptyStepGridColumnPresets();
  }

  const result: StepGridColumnPresets = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;

    const entries = value
      .map((item): GridColumnPresetEntry | null => {
        if (typeof item === 'string') {
          const trimmed = item.trim();
          return trimmed ? { value: trimmed, label: trimmed } : null;
        }
        if (item && typeof item === 'object' && 'value' in item && 'label' in item) {
          const entry = item as GridColumnPresetEntry;
          const valueText = String(entry.value ?? '').trim();
          const labelText = String(entry.label ?? '').trim();
          if (!valueText || !labelText) return null;
          const normalized: GridColumnPresetEntry = { value: valueText, label: labelText };
          if (entry.isDefault === true) {
            normalized.isDefault = true;
          }
          return normalized;
        }
        return null;
      })
      .filter((item): item is GridColumnPresetEntry => item !== null);

    let hasDefault = false;
    result[key] = entries.map((entry) => {
      if (!entry.isDefault || hasDefault) {
        return { value: entry.value, label: entry.label };
      }
      hasDefault = true;
      return entry;
    });
  }

  return result;
}
