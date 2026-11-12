import { CORRAL_VISUAL_CONDITION_CODES, CorralVisualConditionCode } from '../constants/corral-activities';

export interface MedicationPreset {
  product: string;
  dose?: string;
  unit?: string;
}

export interface StepFindingPresets {
  observations: string[];
  conditions: CorralVisualConditionCode[];
  medications: MedicationPreset[];
  defaultObservations: string[];
  defaultConditions: CorralVisualConditionCode[];
  defaultMedicationKeys: string[];
}

export function medicationPresetKey(preset: MedicationPreset): string {
  return `${preset.product}|${preset.dose ?? ''}|${preset.unit ?? ''}`;
}

export function createEmptyStepFindingPresets(): StepFindingPresets {
  return {
    observations: [],
    conditions: [],
    medications: [],
    defaultObservations: [],
    defaultConditions: [],
    defaultMedicationKeys: []
  };
}

export function normalizeStepFindingPresets(raw: unknown): StepFindingPresets {
  const empty = createEmptyStepFindingPresets();
  if (!raw || typeof raw !== 'object') return empty;

  const source = raw as {
    observations?: unknown;
    conditions?: unknown;
    medications?: unknown;
    defaultObservation?: unknown;
    defaultObservations?: unknown;
    defaultCondition?: unknown;
    defaultConditions?: unknown;
    defaultMedicationKey?: unknown;
    defaultMedicationKeys?: unknown;
  };
  const observations = uniqueStrings(
    Array.isArray(source.observations)
      ? source.observations.map((item) => String(item).trim()).filter((item) => item.length > 0)
      : []
  );
  const conditions = uniqueStrings(
    Array.isArray(source.conditions)
      ? source.conditions.filter((item): item is CorralVisualConditionCode =>
          CORRAL_VISUAL_CONDITION_CODES.includes(item as CorralVisualConditionCode)
        )
      : []
  ) as CorralVisualConditionCode[];
  const medications = Array.isArray(source.medications)
    ? source.medications.flatMap((item): MedicationPreset[] => {
        if (!item || typeof item !== 'object' || !('product' in item)) return [];
        const preset = item as MedicationPreset;
        const product = String(preset.product ?? '').trim();
        if (!product) return [];
        return [
          {
            product,
            dose: preset.dose?.trim() || undefined,
            unit: preset.unit?.trim() || undefined
          }
        ];
      })
    : [];

  const defaultObservations = uniqueStrings([
    ...(Array.isArray(source.defaultObservations) ? source.defaultObservations.map((item) => String(item)) : []),
    ...(typeof source.defaultObservation === 'string' ? [source.defaultObservation] : [])
  ]).filter((item) => observations.includes(item));

  const defaultConditions = uniqueStrings([
    ...(Array.isArray(source.defaultConditions) ? source.defaultConditions.map((item) => String(item)) : []),
    ...(typeof source.defaultCondition === 'string' ? [source.defaultCondition] : [])
  ]).filter((item): item is CorralVisualConditionCode =>
    conditions.includes(item as CorralVisualConditionCode)
  ) as CorralVisualConditionCode[];

  const medicationKeys = new Set(medications.map((preset) => medicationPresetKey(preset)));
  const defaultMedicationKeys = uniqueStrings([
    ...(Array.isArray(source.defaultMedicationKeys)
      ? source.defaultMedicationKeys.map((item) => String(item))
      : []),
    ...(typeof source.defaultMedicationKey === 'string' ? [source.defaultMedicationKey] : [])
  ]).filter((key) => medicationKeys.has(key));

  return {
    observations,
    conditions,
    medications,
    defaultObservations,
    defaultConditions,
    defaultMedicationKeys
  };
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}
