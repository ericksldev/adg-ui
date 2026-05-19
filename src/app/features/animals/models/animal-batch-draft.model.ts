import type { AnimalOriginType, AnimalSex } from './animal-api-fields.model';

/**
 * One draft row for batch entry (camelCase for forms). Aligns with animal creation rules:
 * no company on row, no weight/status/active — those are system defaults on create.
 */
export interface AnimalBatchDraftRow {
  registrationNumber: string;
  chipNumber: string;
  ranchUuid: string;
  breedCode: string;
  motherRegistrationNumber: string;
  fatherRegistrationNumber: string;
  currentOwnerUuid: string;
  currentPaddockUuid: string;
  sex: AnimalSex | '';
  color: string;
  birthDate: string;
  originType: AnimalOriginType | '';
  description: string;
}

export const ANIMAL_BATCH_DRAFT_ROW_KEYS: (keyof AnimalBatchDraftRow)[] = [
  'registrationNumber',
  'chipNumber',
  'ranchUuid',
  'breedCode',
  'motherRegistrationNumber',
  'fatherRegistrationNumber',
  'currentOwnerUuid',
  'currentPaddockUuid',
  'sex',
  'color',
  'birthDate',
  'originType',
  'description'
];

export const ANIMAL_BATCH_DRAFT_VERSION = 6 as const;

export interface AnimalBatchDraftSnapshot {
  version: typeof ANIMAL_BATCH_DRAFT_VERSION;
  rowSlotCount: number;
  rows: AnimalBatchDraftRow[];
}
