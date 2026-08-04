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
  | 'fatherRegistration';

export type AnimalListOptionalColumnKey = Exclude<
  AnimalListColumnKey,
  'registrationNumber' | 'breed' | 'sex' | 'birthDate' | 'currentStatus'
>;

export interface AnimalListColumnDef {
  key: AnimalListColumnKey;
  labelKey: string;
  optional?: boolean;
}

/** Columns always shown in inventory (actions are separate). */
export const ANIMAL_LIST_BASIC_COLUMN_KEYS: readonly AnimalListColumnKey[] = [
  'registrationNumber',
  'breed',
  'sex',
  'birthDate',
  'currentStatus'
] as const;

export const ANIMAL_LIST_TABLE_COLUMNS: readonly AnimalListColumnDef[] = [
  { key: 'registrationNumber', labelKey: 'animal.fieldRegistrationNumber' },
  { key: 'breed', labelKey: 'animal.fieldBreed' },
  { key: 'sex', labelKey: 'animal.sex' },
  { key: 'birthDate', labelKey: 'animal.fieldBirthDate' },
  { key: 'currentStatus', labelKey: 'animal.fieldCurrentStatus' },
  { key: 'chipNumber', labelKey: 'animal.fieldChipNumber', optional: true },
  { key: 'color', labelKey: 'animal.fieldColor', optional: true },
  { key: 'originType', labelKey: 'animal.fieldOriginType', optional: true },
  { key: 'ranch', labelKey: 'animal.fieldRanch', optional: true },
  { key: 'owner', labelKey: 'animal.fieldOwner', optional: true },
  { key: 'paddock', labelKey: 'animal.fieldPaddock', optional: true },
  { key: 'motherRegistration', labelKey: 'animal.fieldMotherRegistration', optional: true },
  { key: 'fatherRegistration', labelKey: 'animal.fieldFatherRegistration', optional: true },
  { key: 'description', labelKey: 'animal.fieldDescription', optional: true }
] as const;

export interface AnimalListOptionalColumnDef {
  key: AnimalListOptionalColumnKey;
  labelKey: string;
}

export const ANIMAL_LIST_OPTIONAL_COLUMNS: readonly AnimalListOptionalColumnDef[] = ANIMAL_LIST_TABLE_COLUMNS.filter(
  (col): col is AnimalListColumnDef & { optional: true; key: AnimalListOptionalColumnKey } => Boolean(col.optional)
).map((col) => ({ key: col.key, labelKey: col.labelKey }));

export const ANIMAL_LIST_DEFAULT_OPTIONAL_VISIBILITY: Record<AnimalListOptionalColumnKey, boolean> = {
  chipNumber: false,
  color: false,
  originType: false,
  description: false,
  ranch: false,
  owner: false,
  paddock: false,
  motherRegistration: false,
  fatherRegistration: false
};

export const ANIMAL_LIST_PAGE_SIZE_OPTIONS: readonly number[] = [10, 25, 50, 100] as const;
export const ANIMAL_LIST_DEFAULT_PAGE_SIZE = 10;
export const ANIMAL_LIST_COLUMNS_STORAGE_PREFIX = 'adg_animal_list_visible_cols_v1';
export const ANIMAL_LIST_PAGE_SIZE_STORAGE_PREFIX = 'adg_animal_list_page_size_v1';
