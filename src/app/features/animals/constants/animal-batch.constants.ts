export const ANIMAL_BATCH_MIN_ROW_SLOTS = 10;
export const ANIMAL_BATCH_MAX_ROW_SLOTS = 500;
export const ANIMAL_BATCH_DEFAULT_ROW_SLOTS = 10;
/** Bumped when draft row shape changes (invalidates old localStorage drafts). */
export const ANIMAL_BATCH_STORAGE_PREFIX = 'adg_animal_batch_draft_v5';
export const ANIMAL_BATCH_COLUMNS_STORAGE_PREFIX = 'adg_animal_batch_visible_cols_v2';
export const ANIMAL_BATCH_PERSIST_DEBOUNCE_MS = 400;

export type AnimalBatchOptionalColumnKey =
  | 'chipNumber'
  | 'motherRegistrationNumber'
  | 'fatherRegistrationNumber'
  | 'currentOwnerUuid'
  | 'currentPaddockUuid'
  | 'color'
  | 'originType'
  | 'description';

export interface AnimalBatchOptionalColumnDef {
  key: AnimalBatchOptionalColumnKey;
  labelKey: string;
}

export const ANIMAL_BATCH_OPTIONAL_COLUMNS: readonly AnimalBatchOptionalColumnDef[] = [
  { key: 'chipNumber', labelKey: 'animal.fieldChipNumber' },
  { key: 'motherRegistrationNumber', labelKey: 'animal.fieldMotherRegistration' },
  { key: 'fatherRegistrationNumber', labelKey: 'animal.fieldFatherRegistration' },
  { key: 'currentOwnerUuid', labelKey: 'animal.fieldOwner' },
  { key: 'currentPaddockUuid', labelKey: 'animal.fieldPaddock' },
  { key: 'color', labelKey: 'animal.fieldColor' },
  { key: 'originType', labelKey: 'animal.fieldOriginType' },
  { key: 'description', labelKey: 'animal.fieldDescription' }
] as const;

export const ANIMAL_BATCH_DEFAULT_OPTIONAL_COLUMN_VISIBILITY: Record<AnimalBatchOptionalColumnKey, boolean> = {
  chipNumber: true,
  motherRegistrationNumber: true,
  fatherRegistrationNumber: true,
  currentOwnerUuid: true,
  currentPaddockUuid: true,
  color: true,
  originType: true,
  description: true
};
