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
  defaultObservation: string | null;
  defaultCondition: CorralVisualConditionCode | null;
  defaultMedicationKey: string | null;
}

export function medicationPresetKey(preset: MedicationPreset): string {
  return `${preset.product}|${preset.dose ?? ''}|${preset.unit ?? ''}`;
}

export function createEmptyStepFindingPresets(): StepFindingPresets {
  return {
    observations: [],
    conditions: [],
    medications: [],
    defaultObservation: null,
    defaultCondition: null,
    defaultMedicationKey: null
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
    defaultCondition?: unknown;
    defaultMedicationKey?: unknown;
  };
  const observations = Array.isArray(source.observations)
    ? source.observations.map((item) => String(item).trim()).filter((item) => item.length > 0)
    : [];
  const conditions = Array.isArray(source.conditions)
    ? source.conditions.filter((item): item is CorralVisualConditionCode =>
        CORRAL_VISUAL_CONDITION_CODES.includes(item as CorralVisualConditionCode)
      )
    : [];
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

  const defaultObservation =
    typeof source.defaultObservation === 'string' && observations.includes(source.defaultObservation)
      ? source.defaultObservation
      : null;
  const defaultCondition =
    typeof source.defaultCondition === 'string' &&
    conditions.includes(source.defaultCondition as CorralVisualConditionCode)
      ? (source.defaultCondition as CorralVisualConditionCode)
      : null;
  const defaultMedicationKey =
    typeof source.defaultMedicationKey === 'string' &&
    medications.some((preset) => medicationPresetKey(preset) === source.defaultMedicationKey)
      ? source.defaultMedicationKey
      : null;

  return {
    observations,
    conditions,
    medications,
    defaultObservation,
    defaultCondition,
    defaultMedicationKey
  };
}
