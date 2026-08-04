import { CorralVisualConditionCode } from '../constants/corral-activities';
import { MedicationPreset } from './corral-finding-presets.model';

export interface RowFindingState {
  observation: string;
  condition: string;
  selectedObservationPresets: string[];
  selectedConditionPresets: CorralVisualConditionCode[];
  medications: MedicationPreset[];
}

export function createEmptyRowFindingState(): RowFindingState {
  return {
    observation: '',
    condition: '',
    selectedObservationPresets: [],
    selectedConditionPresets: [],
    medications: []
  };
}
