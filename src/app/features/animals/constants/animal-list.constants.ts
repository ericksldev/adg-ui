export type AnimalListColumnKey =
  | 'registrationNumber'
  | 'breed'
  | 'sex'
  | 'birthDate'
  | 'currentStatus'
  | 'chipNumber'
  | 'color'
  | 'originType'
  | 'description'
  | 'ranch'
  | 'owner'
  | 'paddock'
  | 'motherRegistration'
  | 'fatherRegistration'
  | 'exitType'
  | 'exitDate'
  | 'exitReason';

export type AnimalListOptionalColumnKey = Exclude<AnimalListColumnKey, 'registrationNumber'>;

export type AnimalBirthDisplayMode = 'date' | 'age';

export interface AnimalListColumnDef {
  key: AnimalListColumnKey;
  labelKey: string;
  optional?: boolean;
  inactiveOnly?: boolean;
}

/** Column always shown in inventory (actions are separate). */
export const ANIMAL_LIST_BASIC_COLUMN_KEYS: readonly AnimalListColumnKey[] = [
  'registrationNumber'
] as const;

export const ANIMAL_LIST_TABLE_COLUMNS: readonly AnimalListColumnDef[] = [
  { key: 'registrationNumber', labelKey: 'animal.fieldRegistrationNumber' },
  { key: 'chipNumber', labelKey: 'animal.fieldChipNumber', optional: true },
  { key: 'breed', labelKey: 'animal.fieldBreed', optional: true },
  { key: 'sex', labelKey: 'animal.sex', optional: true },
  { key: 'color', labelKey: 'animal.fieldColor', optional: true },
  { key: 'birthDate', labelKey: 'animal.fieldBirthDate', optional: true },
  { key: 'originType', labelKey: 'animal.fieldOriginType', optional: true },
  { key: 'ranch', labelKey: 'animal.fieldRanch', optional: true },
  { key: 'owner', labelKey: 'animal.fieldOwner', optional: true },
  { key: 'paddock', labelKey: 'animal.fieldPaddock', optional: true },
  { key: 'motherRegistration', labelKey: 'animal.fieldMotherRegistration', optional: true },
  { key: 'fatherRegistration', labelKey: 'animal.fieldFatherRegistration', optional: true },
  { key: 'currentStatus', labelKey: 'animal.fieldCurrentStatus', optional: true },
  { key: 'exitType', labelKey: 'animal.exitType', optional: true, inactiveOnly: true },
  { key: 'exitDate', labelKey: 'animal.exitDate', optional: true, inactiveOnly: true },
  { key: 'exitReason', labelKey: 'animal.exitReason', optional: true, inactiveOnly: true },
  { key: 'description', labelKey: 'animal.fieldDescription', optional: true }
] as const;

export interface AnimalListOptionalColumnDef {
  key: AnimalListOptionalColumnKey;
  labelKey: string;
  inactiveOnly?: boolean;
}

export const ANIMAL_LIST_OPTIONAL_COLUMNS: readonly AnimalListOptionalColumnDef[] = ANIMAL_LIST_TABLE_COLUMNS.filter(
  (col): col is AnimalListColumnDef & { optional: true; key: AnimalListOptionalColumnKey } => Boolean(col.optional)
).map((col) => ({ key: col.key, labelKey: col.labelKey, inactiveOnly: col.inactiveOnly }));

export const ANIMAL_LIST_DEFAULT_OPTIONAL_VISIBILITY: Record<AnimalListOptionalColumnKey, boolean> = {
  chipNumber: false,
  breed: true,
  sex: true,
  color: false,
  birthDate: true,
  originType: false,
  ranch: false,
  owner: false,
  paddock: false,
  motherRegistration: false,
  fatherRegistration: false,
  currentStatus: true,
  exitType: true,
  exitDate: true,
  exitReason: true,
  description: false
};

export const ANIMAL_LIST_DEFAULT_BIRTH_DISPLAY: AnimalBirthDisplayMode = 'date';

export const ANIMAL_LIST_PAGE_SIZE_OPTIONS: readonly number[] = [10, 25, 50, 100] as const;
export const ANIMAL_LIST_DEFAULT_PAGE_SIZE = 10;
export const ANIMAL_LIST_COLUMNS_STORAGE_PREFIX = 'vrete_animal_list_visible_cols_v1';
export const ANIMAL_LIST_PAGE_SIZE_STORAGE_PREFIX = 'vrete_animal_list_page_size_v1';
export const ANIMAL_LIST_BIRTH_DISPLAY_STORAGE_PREFIX = 'vrete_animal_list_birth_display_v1';
export const ANIMAL_LIST_COLUMNS_STORAGE_PREFIX_LEGACY = 'adg_animal_list_visible_cols_v1';
export const ANIMAL_LIST_PAGE_SIZE_STORAGE_PREFIX_LEGACY = 'adg_animal_list_page_size_v1';
export const ANIMAL_LIST_BIRTH_DISPLAY_STORAGE_PREFIX_LEGACY = 'adg_animal_list_birth_display_v1';
