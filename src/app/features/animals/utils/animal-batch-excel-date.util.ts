import * as XLSX from 'xlsx';

export const EXCEL_BIRTH_DATE_HEADERS = [
  'birth_date',
  'birthdate',
  'date_of_birth',
  'dob',
  'fecha_nacimiento',
  'fecha_de_nacimiento',
  'nacimiento',
  'fecha_nac'
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoFromParts(y: number, m: number, d: number): string {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
    return '';
  }
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) {
    return '';
  }
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function isoFromDate(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return isoFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function isoFromExcelSerial(serial: number): string {
  if (!Number.isFinite(serial) || serial <= 0) {
    return '';
  }
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed?.y || !parsed?.m || !parsed?.d) {
    return '';
  }
  return isoFromParts(parsed.y, parsed.m, parsed.d);
}

/** Normalizes Excel / text birth dates to YYYY-MM-DD for HTML date inputs. */
export function normalizeBirthDateCell(raw: unknown): string {
  if (raw == null || raw === '') {
    return '';
  }

  if (raw instanceof Date) {
    return isoFromDate(raw);
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return isoFromExcelSerial(raw);
  }

  const text = String(raw).trim();
  if (!text) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const isoPrefix = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  if (isoPrefix) {
    return isoPrefix[1];
  }

  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(text);
  if (dmy) {
    return isoFromParts(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  }

  const ymd = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/.exec(text);
  if (ymd) {
    return isoFromParts(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  }

  const asNumber = Number(text);
  if (!Number.isNaN(asNumber) && text.length <= 8) {
    return isoFromExcelSerial(asNumber);
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return isoFromDate(parsed);
  }

  return '';
}

export function pickBirthDateFromRecord(
  record: Record<string, unknown>,
  normalizeHeaderKey: (key: string) => string
): string {
  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = normalizeHeaderKey(key);
    if (!(EXCEL_BIRTH_DATE_HEADERS as readonly string[]).includes(normalizedKey)) {
      continue;
    }
    const iso = normalizeBirthDateCell(value);
    if (iso) {
      return iso;
    }
  }
  return '';
}
