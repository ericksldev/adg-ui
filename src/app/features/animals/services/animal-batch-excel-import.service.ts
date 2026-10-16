import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { AnimalBatchOptionalColumnKey } from '../constants/animal-batch.constants';
import { AnimalBatchExcelParseResult } from '../models/animal-batch-excel-parse.model';
import { AnimalBatchDraftRow } from '../models/animal-batch-draft.model';
import { batchDraftRowHasData, emptyBatchDraftRow } from '../utils/animal-batch-draft.utils';
import { pickBirthDateFromRecord } from '../utils/animal-batch-excel-date.util';

const EXCEL_OPTIONAL_COLUMN_HEADERS: Record<AnimalBatchOptionalColumnKey, readonly string[]> = {
  breedCode: ['breed_code', 'breedcode', 'breed', 'raza', 'raca', 'raça', 'breed_uuid', 'breeduuid', 'uuid_breed'],
  chipNumber: ['chip_number', 'chip', 'chipnumber', 'numero_chip', 'no_chip', 'arete', 'id_chip', 'brinco'],
  motherRegistrationNumber: [
    'mother_registration_number',
    'mother_reg',
    'madre_registro',
    'registro_madre'
  ],
  fatherRegistrationNumber: [
    'father_registration_number',
    'father_reg',
    'padre_registro',
    'registro_padre'
  ],
  currentOwnerUuid: [
    'current_owner_uuid',
    'owner_uuid',
    'uuid_propietario',
    'propietario',
    'proprietario',
    'dueno',
    'dueño',
    'owner',
    'nombre_propietario'
  ],
  currentPaddockUuid: [
    'current_paddock_uuid',
    'paddock_uuid',
    'uuid_potrero',
    'uuid_piquete',
    'potrero',
    'piquete',
    'paddock',
    'nombre_potrero'
  ],
  color: ['color', 'cor'],
  originType: ['origin_type', 'origen', 'origem', 'tipo_origen'],
  categories: ['categories', 'categorias', 'categoria', 'category', 'livestock_category', 'categorias_ganaderas'],
  description: ['description', 'descripcion', 'descrição', 'descricao', 'detalle', 'notas']
};

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

function pickFromKeys(cells: Record<string, string>, keys: readonly string[]): string {
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
  return pickFromKeys(cells, ['ranch_uuid', 'ranchuuid', 'uuid_ranch', 'uuid_rancho', 'ranch', 'rancho', 'fazenda']);
}

function pickBreedCode(cells: Record<string, string>): string {
  return pickFromKeys(cells, EXCEL_OPTIONAL_COLUMN_HEADERS.breedCode);
}

function pickSexRaw(cells: Record<string, string>): string {
  return pickFromKeys(cells, ['sex', 'sexo', 'gender']);
}

function extractNormalizedHeaders(worksheet: XLSX.WorkSheet): string[] {
  const matrix = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(worksheet, {
    header: 1,
    defval: ''
  }) as unknown[][];
  if (!matrix.length || !Array.isArray(matrix[0])) {
    return [];
  }
  return matrix[0].map((cell) => normalizeHeaderKey(String(cell ?? ''))).filter(Boolean);
}

function detectOptionalColumnsInHeaders(normalizedHeaders: string[]): AnimalBatchOptionalColumnKey[] {
  const headerSet = new Set(normalizedHeaders);
  return (Object.entries(EXCEL_OPTIONAL_COLUMN_HEADERS) as [AnimalBatchOptionalColumnKey, readonly string[]][])
    .filter(([, aliases]) => aliases.some((alias) => headerSet.has(alias)))
    .map(([key]) => key);
}

function mapObjectRow(record: Record<string, unknown>): AnimalBatchDraftRow {
  const cells = normalizedCells(record);
  const base = emptyBatchDraftRow();
  return {
    ...base,
    registrationNumber: pickFromKeys(cells, ['registration_number', 'registro', 'numero_registro', 'id_registro']),
    chipNumber: pickFromKeys(cells, EXCEL_OPTIONAL_COLUMN_HEADERS.chipNumber),
    ranchUuid: pickRanchUuid(cells),
    breedCode: pickBreedCode(cells),
    motherRegistrationNumber: pickFromKeys(cells, EXCEL_OPTIONAL_COLUMN_HEADERS.motherRegistrationNumber),
    fatherRegistrationNumber: pickFromKeys(cells, EXCEL_OPTIONAL_COLUMN_HEADERS.fatherRegistrationNumber),
    currentOwnerUuid: pickFromKeys(cells, EXCEL_OPTIONAL_COLUMN_HEADERS.currentOwnerUuid),
    currentPaddockUuid: pickFromKeys(cells, EXCEL_OPTIONAL_COLUMN_HEADERS.currentPaddockUuid),
    sex: pickSexRaw(cells) as AnimalBatchDraftRow['sex'],
    color: pickFromKeys(cells, EXCEL_OPTIONAL_COLUMN_HEADERS.color),
    birthDate: pickBirthDateFromRecord(record, normalizeHeaderKey),
    originType: pickFromKeys(cells, EXCEL_OPTIONAL_COLUMN_HEADERS.originType) as AnimalBatchDraftRow['originType'],
    categories: pickFromKeys(cells, EXCEL_OPTIONAL_COLUMN_HEADERS.categories),
    description: pickFromKeys(cells, EXCEL_OPTIONAL_COLUMN_HEADERS.description)
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
  parseFirstSheet(buffer: ArrayBuffer): AnimalBatchExcelParseResult {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const firstName = workbook.SheetNames[0];
    if (!firstName) {
      return { rows: [], optionalColumnsInFile: [] };
    }
    const worksheet = workbook.Sheets[firstName];
    if (!worksheet) {
      return { rows: [], optionalColumnsInFile: [] };
    }

    const optionalColumnsInFile = detectOptionalColumnsInHeaders(extractNormalizedHeaders(worksheet));
    const fromObjects = parseFromObjectRows(worksheet);
    if (fromObjects.length > 0) {
      return { rows: fromObjects, optionalColumnsInFile };
    }

    const headers = extractNormalizedHeaders(worksheet);
    const looksLikeHeaderRow = headers.some((header) =>
      header === 'registro' ||
      header === 'rancho' ||
      header === 'ranch_uuid' ||
      header === 'sexo' ||
      header === 'sex' ||
      header === 'fecha_nacimiento'
    );
    if (looksLikeHeaderRow) {
      return { rows: [], optionalColumnsInFile };
    }

    return { rows: parseFromGridRows(worksheet), optionalColumnsInFile: [] };
  }

  /**
   * Workbook whose first sheet is the import grid.
   * Later sheets only list names that already exist for the company.
   */
  buildTemplateWorkbook(input: AnimalBatchTemplateInput): BlobPart {
    const workbook = XLSX.utils.book_new();
    const animals = XLSX.utils.aoa_to_sheet([[...TEMPLATE_ANIMAL_HEADERS]]);
    animals['!cols'] = TEMPLATE_ANIMAL_HEADERS.map((header) => ({ wch: Math.max(header.length + 2, 18) }));
    XLSX.utils.book_append_sheet(workbook, animals, input.sheetData);

    const listRows: string[][] = [[
      input.listHeaders.ranches,
      input.listHeaders.owners,
      input.listHeaders.breeds,
      input.listHeaders.sexes,
      input.listHeaders.origins,
      input.listHeaders.categories
    ]];
    const listHeight = Math.max(
      input.ranchNames.length,
      input.ownerNames.length,
      input.breedLabels.length,
      input.sexLabels.length,
      input.originLabels.length,
      input.categoryNames.length
    );
    for (let i = 0; i < listHeight; i++) {
      listRows.push([
        input.ranchNames[i] ?? '',
        input.ownerNames[i] ?? '',
        input.breedLabels[i] ?? '',
        input.sexLabels[i] ?? '',
        input.originLabels[i] ?? '',
        input.categoryNames[i] ?? ''
      ]);
    }
    const lists = XLSX.utils.aoa_to_sheet(listRows);
    lists['!cols'] = [{ wch: 28 }, { wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(workbook, lists, input.sheetLists);

    const paddockRows: string[][] = [[input.paddockHeaders.ranch, input.paddockHeaders.paddock]];
    for (const paddock of input.paddocks) {
      paddockRows.push([paddock.ranchName, paddock.paddockName]);
    }
    const paddocks = XLSX.utils.aoa_to_sheet(paddockRows);
    paddocks['!cols'] = [{ wch: 28 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(workbook, paddocks, input.sheetPaddocks);

    const help = XLSX.utils.aoa_to_sheet(input.helpLines.map((line) => [line]));
    help['!cols'] = [{ wch: 110 }];
    XLSX.utils.book_append_sheet(workbook, help, input.sheetHelp);

    return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as BlobPart;
  }
}

/** Headers the importer already understands. Kept stable so the template round-trips. */
const TEMPLATE_ANIMAL_HEADERS = [
  'registro',
  'rancho',
  'sexo',
  'fecha_nacimiento',
  'raza',
  'chip',
  'registro_madre',
  'registro_padre',
  'propietario',
  'potrero',
  'color',
  'origen',
  'categorias',
  'descripcion'
] as const;

export interface AnimalBatchTemplateInput {
  sheetData: string;
  sheetLists: string;
  sheetPaddocks: string;
  sheetHelp: string;
  listHeaders: {
    ranches: string;
    owners: string;
    breeds: string;
    sexes: string;
    origins: string;
    categories: string;
  };
  paddockHeaders: { ranch: string; paddock: string };
  helpLines: string[];
  ranchNames: string[];
  ownerNames: string[];
  breedLabels: string[];
  sexLabels: string[];
  originLabels: string[];
  categoryNames: string[];
  paddocks: { ranchName: string; paddockName: string }[];
}
