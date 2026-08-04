export interface GridColumnPresetEntry {
  value: string;
  label: string;
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

    result[key] = value
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
          return { value: valueText, label: labelText };
        }
        return null;
      })
      .filter((item): item is GridColumnPresetEntry => item !== null);
  }

  return result;
}
