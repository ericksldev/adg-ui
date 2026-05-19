import { ANIMAL_BATCH_DRAFT_ROW_KEYS, AnimalBatchDraftRow } from '../models/animal-batch-draft.model';

export function batchDraftRowHasData(row: AnimalBatchDraftRow): boolean {
  const s = (v: string | undefined) => String(v ?? '').trim();
  return ANIMAL_BATCH_DRAFT_ROW_KEYS.some((key) => s(row[key]));
}

export function emptyBatchDraftRow(): AnimalBatchDraftRow {
  return {
    registrationNumber: '',
    chipNumber: '',
    ranchUuid: '',
    breedCode: '',
    motherRegistrationNumber: '',
    fatherRegistrationNumber: '',
    currentOwnerUuid: '',
    currentPaddockUuid: '',
    sex: '',
    color: '',
    birthDate: '',
    originType: '',
    description: ''
  };
}
