export type CorralActivityValueType = 'boolean' | 'number' | 'text' | 'medicine';

export type CorralActivityDefaultWorkMode = 'SCAN_DYNAMIC' | 'PRELOADED_SEARCH' | 'PRELOADED_QUEUE';

export interface CorralActivityDefinition {
  code: string;
  icon: string;
  defaultWorkMode: CorralActivityDefaultWorkMode;
  columnLabel: string;
  valueType: CorralActivityValueType;
  multiRecord: boolean;
  historyTarget?: string;
}

/** Single source of truth for corral activity codes (UI + API). */
export const CORRAL_ACTIVITY_CATALOG: readonly CorralActivityDefinition[] = [
  {
    code: 'ATTENDANCE',
    icon: 'bi-clipboard2-check',
    defaultWorkMode: 'SCAN_DYNAMIC',
    columnLabel: 'Attendance',
    valueType: 'boolean',
    multiRecord: false
  },
  {
    code: 'WEIGHING',
    icon: 'bi-speedometer2',
    defaultWorkMode: 'SCAN_DYNAMIC',
    columnLabel: 'Weight',
    valueType: 'number',
    multiRecord: false,
    historyTarget: 'weight_records'
  },
  {
    code: 'VACCINATION',
    icon: 'bi-shield-plus',
    defaultWorkMode: 'SCAN_DYNAMIC',
    columnLabel: 'Vaccine',
    valueType: 'medicine',
    multiRecord: true,
    historyTarget: 'health_campaign_animals'
  },
  {
    code: 'IDENTIFICATION',
    icon: 'bi-upc-scan',
    defaultWorkMode: 'SCAN_DYNAMIC',
    columnLabel: 'Identification',
    valueType: 'text',
    multiRecord: false,
    historyTarget: 'animal_identifications'
  },
  {
    code: 'DEWORMING',
    icon: 'bi-bug',
    defaultWorkMode: 'SCAN_DYNAMIC',
    columnLabel: 'Deworming',
    valueType: 'medicine',
    multiRecord: true,
    historyTarget: 'corral_deworming_entries'
  },
  {
    code: 'TREATMENT',
    icon: 'bi-heart-pulse',
    defaultWorkMode: 'SCAN_DYNAMIC',
    columnLabel: 'Treatment',
    valueType: 'text',
    multiRecord: false,
    historyTarget: 'corral_treatment_entries'
  },
  {
    code: 'INSPECTION',
    icon: 'bi-eye',
    defaultWorkMode: 'SCAN_DYNAMIC',
    columnLabel: 'Inspection',
    valueType: 'text',
    multiRecord: false
  }
] as const;

export type CorralActivityCode = (typeof CORRAL_ACTIVITY_CATALOG)[number]['code'];

export const CORRAL_ACTIVITY_CODES: CorralActivityCode[] = CORRAL_ACTIVITY_CATALOG.map(
  (item) => item.code as CorralActivityCode
);

export const CORRAL_ACTIVITY_CODE_SET = new Set<string>(CORRAL_ACTIVITY_CODES);

export function isCorralActivityCode(value: string | null | undefined): value is CorralActivityCode {
  return typeof value === 'string' && CORRAL_ACTIVITY_CODE_SET.has(value);
}

export function getCorralActivityDefinition(code: string): CorralActivityDefinition | undefined {
  return CORRAL_ACTIVITY_CATALOG.find((item) => item.code === code);
}

export const CORRAL_ACTIVITY_ICONS: Record<CorralActivityCode, string> = CORRAL_ACTIVITY_CATALOG.reduce(
  (acc, item) => {
    acc[item.code as CorralActivityCode] = item.icon;
    return acc;
  },
  {} as Record<CorralActivityCode, string>
);

export const CORRAL_MULTI_RECORD_ACTIVITY_CODES: CorralActivityCode[] = CORRAL_ACTIVITY_CATALOG.filter(
  (item) => item.multiRecord
).map((item) => item.code as CorralActivityCode);

export function isMultiRecordActivity(code: CorralActivityCode | string): boolean {
  return CORRAL_MULTI_RECORD_ACTIVITY_CODES.includes(code as CorralActivityCode);
}

export const CORRAL_ACTIVITY_HISTORY_TARGET: Partial<Record<CorralActivityCode, string>> =
  CORRAL_ACTIVITY_CATALOG.reduce((acc, item) => {
    if (item.historyTarget) {
      acc[item.code as CorralActivityCode] = item.historyTarget;
    }
    return acc;
  }, {} as Partial<Record<CorralActivityCode, string>>);

export const CORRAL_ACTIVITY_COLUMN_LABELS: Record<CorralActivityCode, string> = CORRAL_ACTIVITY_CATALOG.reduce(
  (acc, item) => {
    acc[item.code as CorralActivityCode] = item.columnLabel;
    return acc;
  },
  {} as Record<CorralActivityCode, string>
);

export const CORRAL_ACTIVITY_VALUE_TYPES: Record<CorralActivityCode, CorralActivityValueType> =
  CORRAL_ACTIVITY_CATALOG.reduce((acc, item) => {
    acc[item.code as CorralActivityCode] = item.valueType;
    return acc;
  }, {} as Record<CorralActivityCode, CorralActivityValueType>);

export const CORRAL_ACTIVITY_DEFAULT_WORK_MODES: Record<CorralActivityCode, CorralActivityDefaultWorkMode> =
  CORRAL_ACTIVITY_CATALOG.reduce((acc, item) => {
    acc[item.code as CorralActivityCode] = item.defaultWorkMode;
    return acc;
  }, {} as Record<CorralActivityCode, CorralActivityDefaultWorkMode>);
