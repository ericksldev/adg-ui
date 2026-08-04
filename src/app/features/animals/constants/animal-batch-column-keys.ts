import { AnimalBatchOptionalColumnKey } from './animal-batch.constants';
import { AnimalBatchDraftRow } from '../models/animal-batch-draft.model';

export type AnimalBatchColumnKey = keyof AnimalBatchDraftRow;

export interface AnimalBatchColumnDef {
  key: AnimalBatchColumnKey;
  labelKey: string;
  optional?: boolean;
}

/** All data columns in grid order (matches table layout). */
export const ANIMAL_BATCH_TABLE_COLUMNS: readonly AnimalBatchColumnDef[] = [
  { key: 'registrationNumber', labelKey: 'animal.fieldRegistrationNumber' },
  { key: 'ranchUuid', labelKey: 'animal.fieldRanch' },
  { key: 'sex', labelKey: 'animal.fieldSex' },
  { key: 'birthDate', labelKey: 'animal.fieldBirthDate' },
  { key: 'breedCode', labelKey: 'animal.fieldBreed', optional: true },
  { key: 'chipNumber', labelKey: 'animal.fieldChipNumber', optional: true },
  { key: 'motherRegistrationNumber', labelKey: 'animal.fieldMotherRegistration', optional: true },
  { key: 'fatherRegistrationNumber', labelKey: 'animal.fieldFatherRegistration', optional: true },
  { key: 'currentOwnerUuid', labelKey: 'animal.fieldOwner', optional: true },
  { key: 'currentPaddockUuid', labelKey: 'animal.fieldPaddock', optional: true },
  { key: 'color', labelKey: 'animal.fieldColor', optional: true },
  { key: 'originType', labelKey: 'animal.fieldOriginType', optional: true },
  { key: 'description', labelKey: 'animal.fieldDescription', optional: true }
] as const;

export function isAnimalBatchOptionalColumnKey(key: AnimalBatchColumnKey): key is AnimalBatchOptionalColumnKey {
  return ANIMAL_BATCH_TABLE_COLUMNS.some((col) => col.optional && col.key === key);
}
