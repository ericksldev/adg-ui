import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { AnimalBatchDraftRow } from '../models/animal-batch-draft.model';
import { batchDraftRowHasData, emptyBatchDraftRow } from '../utils/animal-batch-draft.utils';

function normalizeHeaderKey(key: string): string {
  return key.toLowerCase().trim().replace(/\s+/g, '_');
}

function normalizedCells(record: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(record)) {
    out[normalizeHeaderKey(k)] = String(v ?? '').trim();
  }
  return out;
}

function pickFromKeys(cells: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    if (cells[key]) {
      return cells[key];
    }
  }
  return '';
}

function normalizeSexCell(raw: string): AnimalBatchDraftRow['sex'] {
  const u = raw.trim().toUpperCase();
  if (u === 'MALE' || u === 'M' || u === 'MACHO' || u === '1') {
    return 'MALE';
  }
  if (u === 'FEMALE' || u === 'F' || u === 'HEMBRA' || u === 'FEMEA' || u === '2') {
    return 'FEMALE';
  }
  return '';
}

function normalizeOriginCell(raw: string): AnimalBatchDraftRow['originType'] {
  const u = raw.trim().toUpperCase();
  if (u === 'BIRTH' || u === 'NACIMIENTO' || u === 'N') {
    return 'BIRTH';
  }
  if (u === 'PURCHASE' || u === 'COMPRA' || u === 'P') {
    return 'PURCHASE';
  }
  if (u === 'TRANSFER' || u === 'TRANSFERENCIA' || u === 'T') {
    return 'TRANSFER';
  }
  if (u === 'UNKNOWN' || u === 'DESCONOCIDO' || u === 'U') {
    return 'UNKNOWN';
  }
  return '';
}

function pickRanchUuid(cells: Record<string, string>): string {
  return pickFromKeys(cells, ['ranch_uuid', 'ranchuuid', 'uuid_ranch', 'uuid_rancho', 'ranch', 'rancho']);
}

function pickBreedCode(cells: Record<string, string>): string {
  return pickFromKeys(cells, ['breed_code', 'breedcode', 'breed', 'raza', 'breed_uuid', 'breeduuid', 'uuid_breed']);
}

function pickSexRaw(cells: Record<string, string>): string {
  return pickFromKeys(cells, ['sex', 'sexo', 'gender']);
}

function mapObjectRow(record: Record<string, unknown>): AnimalBatchDraftRow {
  const cells = normalizedCells(record);
  const base = emptyBatchDraftRow();
  return {
    ...base,
    registrationNumber: pickFromKeys(cells, ['registration_number', 'registro', 'numero_registro', 'id_registro']),
    chipNumber: pickFromKeys(cells, [
      'chip_number',
      'chip',
      'chipnumber',
      'numero_chip',
      'no_chip',
      'arete',
      'id_chip'
    ]),
    ranchUuid: pickRanchUuid(cells),
    breedCode: pickBreedCode(cells),
    motherRegistrationNumber: pickFromKeys(cells, [
      'mother_registration_number',
      'mother_reg',
      'madre_registro',
      'registro_madre'
    ]),
    fatherRegistrationNumber: pickFromKeys(cells, [
      'father_registration_number',
      'father_reg',
      'padre_registro',
      'registro_padre'
    ]),
    currentOwnerUuid: pickFromKeys(cells, ['current_owner_uuid', 'owner_uuid', 'uuid_propietario']),
    currentPaddockUuid: pickFromKeys(cells, ['current_paddock_uuid', 'paddock_uuid', 'uuid_potrero', 'uuid_piquete']),
    sex: normalizeSexCell(pickSexRaw(cells)),
    color: pickFromKeys(cells, ['color']),
    birthDate: pickFromKeys(cells, ['birth_date', 'birthdate', 'fecha_nacimiento', 'nacimiento']),
    originType: normalizeOriginCell(pickFromKeys(cells, ['origin_type', 'origen', 'tipo_origen'])),
    description: pickFromKeys(cells, ['description', 'descripcion', 'detalle', 'notas'])
  };
}

function parseFromObjectRows(worksheet: XLSX.WorkSheet): AnimalBatchDraftRow[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
  return rows
    .map((row: Record<string, unknown>) => mapObjectRow(row))
    .filter((r: AnimalBatchDraftRow) => batchDraftRowHasData(r));
}

function parseFromGridRows(worksheet: XLSX.WorkSheet): AnimalBatchDraftRow[] {
  const matrix = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(worksheet, {
    header: 1,
    defval: ''
  }) as unknown[][];
  const out: AnimalBatchDraftRow[] = [];
  for (const row of matrix) {
    if (!Array.isArray(row)) {
      continue;
    }
    const draft = emptyBatchDraftRow();
    draft.ranchUuid = String(row[0] ?? '').trim();
    draft.breedCode = String(row[1] ?? '').trim();
    draft.sex = normalizeSexCell(String(row[2] ?? ''));
    if (batchDraftRowHasData(draft)) {
      out.push(draft);
    }
  }
  return out;
}

@Injectable({
  providedIn: 'root'
})
export class AnimalBatchExcelImportService {
  parseFirstSheet(buffer: ArrayBuffer): AnimalBatchDraftRow[] {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const firstName = workbook.SheetNames[0];
    if (!firstName) {
      return [];
    }
    const worksheet = workbook.Sheets[firstName];
    if (!worksheet) {
      return [];
    }

    const fromObjects = parseFromObjectRows(worksheet);
    if (fromObjects.length > 0) {
      return fromObjects;
    }

    return parseFromGridRows(worksheet);
  }

  mergeIntoSlotCount(imported: AnimalBatchDraftRow[], slotCount: number): AnimalBatchDraftRow[] {
    const safe: AnimalBatchDraftRow[] = imported.slice(0, slotCount).map((r: AnimalBatchDraftRow) => ({ ...r }));
    while (safe.length < slotCount) {
      safe.push(emptyBatchDraftRow());
    }
    return safe;
  }
}
