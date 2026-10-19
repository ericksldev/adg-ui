import { ANIMAL_BATCH_OPTIONAL_COLUMNS, AnimalBatchOptionalColumnKey } from '../constants/animal-batch.constants';
import { ANIMAL_BATCH_DRAFT_ROW_KEYS, AnimalBatchDraftRow } from '../models/animal-batch-draft.model';

export function batchDraftRowHasData(row: AnimalBatchDraftRow): boolean {
  const s = (v: string | undefined) => String(v ?? '').trim();
  // Ignore default placeholders used in form controls.
  const meaningfulDefaultsIgnored = {
    ...row,
    breedCode: s(row.breedCode) === 'UNKNOWN' ? '' : row.breedCode,
    sex: s(row.sex) === 'MALE' ? '' : row.sex,
    originType: s(row.originType) === 'UNKNOWN' ? '' : row.originType
  } as AnimalBatchDraftRow;
  return ANIMAL_BATCH_DRAFT_ROW_KEYS.some((key) => s(meaningfulDefaultsIgnored[key]));
}

/** Shows only optional columns detected in an imported Excel file. */
export function optionalColumnVisibilityForImport(
  columnsInFile: AnimalBatchOptionalColumnKey[]
): Record<AnimalBatchOptionalColumnKey, boolean> {
  const inFile = new Set(columnsInFile);
  const next = {} as Record<AnimalBatchOptionalColumnKey, boolean>;
  for (const col of ANIMAL_BATCH_OPTIONAL_COLUMNS) {
    next[col.key] = inFile.has(col.key);
  }
  return next;
}

export function emptyBatchDraftRow(): AnimalBatchDraftRow {
  return {
    registrationNumber: '',
    chipNumber: '',
    ranchUuid: '',
    breedCode: '',
    motherRegistrationNumber: '',
    fatherRegistrationNumber: '',
    motherAnimalUuid: '',
    fatherAnimalUuid: '',
    pendingRowUuid: '',
    currentOwnerUuid: '',
    currentPaddockUuid: '',
    sex: '',
    color: '',
    birthDate: '',
    originType: '',
    categories: '',
    description: ''
  };
}

export function matchBatchCategoryIds(
  raw: string,
  catalog: readonly { category_uuid: string; name: string }[]
): { ids: string[]; unknown: string[] } {
  const fold = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  const byName = new Map(catalog.map((item) => [fold(item.name), item.category_uuid]));
  const byId = new Map(catalog.map((item) => [item.category_uuid, item.category_uuid]));
  const ids: string[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();
  for (const label of String(raw ?? '').split(/[,;|]/)) {
    const name = label.trim();
    if (!name) {
      continue;
    }
    const id = byId.get(name) ?? byName.get(fold(name));
    if (!id) {
      unknown.push(name);
      continue;
    }
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return { ids, unknown };
}
