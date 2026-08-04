import { CorralVisualConditionCode } from '../constants/corral-activities';

export interface MedicationPreset {
  product: string;
  dose?: string;
  unit?: string;
}

export interface StepFindingPresets {
  observations: string[];
  conditions: CorralVisualConditionCode[];
  medications: MedicationPreset[];
}

export function createEmptyStepFindingPresets(): StepFindingPresets {
  return {
    observations: [],
    conditions: [],
    medications: []
  };
}
