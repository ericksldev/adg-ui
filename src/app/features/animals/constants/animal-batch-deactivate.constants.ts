/** Display columns for the batch-deactivate animal picker (registration is always shown). */
export type AnimalBatchDeactivateDisplayColumnKey =
  | 'breed'
  | 'sex'
  | 'color'
  | 'birthDate'
  | 'chipNumber'
  | 'originType'
  | 'ranch'
  | 'owner'
  | 'paddock'
  | 'motherRegistration'
  | 'fatherRegistration'
  | 'description'
  | 'currentStatus';

export interface AnimalBatchDeactivateDisplayColumnDef {
  key: AnimalBatchDeactivateDisplayColumnKey;
  labelKey: string;
}

export const ANIMAL_BATCH_DEACTIVATE_DISPLAY_COLUMNS: readonly AnimalBatchDeactivateDisplayColumnDef[] = [
  { key: 'breed', labelKey: 'animal.fieldBreed' },
  { key: 'sex', labelKey: 'animal.sex' },
  { key: 'color', labelKey: 'animal.fieldColor' },
  { key: 'birthDate', labelKey: 'animal.fieldBirthDateShort' },
  { key: 'chipNumber', labelKey: 'animal.fieldChipNumber' },
  { key: 'originType', labelKey: 'animal.fieldOriginType' },
  { key: 'ranch', labelKey: 'animal.fieldRanch' },
  { key: 'owner', labelKey: 'animal.fieldOwner' },
  { key: 'paddock', labelKey: 'animal.fieldPaddock' },
  { key: 'motherRegistration', labelKey: 'animal.fieldMotherRegistration' },
  { key: 'fatherRegistration', labelKey: 'animal.fieldFatherRegistration' },
  { key: 'currentStatus', labelKey: 'animal.fieldCurrentStatus' },
  { key: 'description', labelKey: 'animal.fieldDescription' }
] as const;

export const ANIMAL_BATCH_DEACTIVATE_DEFAULT_COLUMN_VISIBILITY: Record<
  AnimalBatchDeactivateDisplayColumnKey,
  boolean
> = {
  breed: false,
  sex: false,
  color: true,
  birthDate: true,
  chipNumber: false,
  originType: false,
  ranch: false,
  owner: false,
  paddock: false,
  motherRegistration: false,
  fatherRegistration: false,
  currentStatus: false,
  description: false
};

export const ANIMAL_BATCH_DEACTIVATE_COLUMNS_STORAGE_PREFIX =
  'vrete_animal_batch_deactivate_visible_cols_v1';
export const ANIMAL_BATCH_DEACTIVATE_COLUMNS_STORAGE_PREFIX_LEGACY =
  'adg_animal_batch_deactivate_visible_cols_v1';
