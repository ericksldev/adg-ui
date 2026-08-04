import { CorralActivityCode, CorralStepWorkMode, CorralVisualConditionCode, CorralWorkSessionStatus } from '../constants/corral-activities';

export interface CorralActivityAssignment {
  activity_code: CorralActivityCode;
  step_order: number;
}

export interface ConfigureCorralWorkStepPayload {
  step_order: number;
  label?: string | null;
  work_mode?: CorralStepWorkMode;
  activity_codes: CorralActivityCode[];
}

export interface ConfigureCorralWorkPayload {
  steps: ConfigureCorralWorkStepPayload[];
}

export interface CorralSessionSourceFilter {
  filter_key: string;
  filter_value: string;
}

export interface CreateCorralWorkSessionPayload {
  ranch_uuid: string;
  work_date: string;
  responsible_person?: string | null;
  notes?: string | null;
  activity_assignments?: CorralActivityAssignment[];
}

export interface CorralSessionAnimalsSourceBody {
  source_paddock_uuids?: string[];
  source_filters?: CorralSessionSourceFilter[];
  manual_animal_uuids?: string[];
}

export interface CorralSessionAnimalsLoadBody extends CorralSessionAnimalsSourceBody {
  step_assignments: CorralStepAnimalAssignment[];
}

export interface CorralStepAnimalAssignment {
  uuid_corral_session_step: string;
  animal_uuids: string[];
}

export interface CorralSessionAnimalPreviewItem {
  animal_uuid: string;
  registration_number: string;
  chip_number?: string | null;
  sex?: string;
  breed_code?: string;
  current_paddock_uuid?: string | null;
}

export interface CorralSessionAnimalsPreviewDto {
  total_count: number;
  animals: CorralSessionAnimalPreviewItem[];
  breakdown: {
    from_paddocks: number;
    from_filters: number;
    from_manual: number;
  };
}

export interface CorralSessionAnimalsLoadResultDto {
  total_count: number;
  sources_saved: number;
}

export interface CorralSessionStepDto {
  uuid_corral_session_step: string;
  step_order: number;
  label?: string | null;
  work_mode?: CorralStepWorkMode;
  activities: CorralActivityCode[];
}

export interface CorralSessionSourceDto {
  uuid_corral_session_source: string;
  source_type: 'PADDOCK' | 'FILTER' | 'MANUAL';
  paddock_uuid?: string | null;
  filter_key?: string | null;
  filter_value?: string | null;
  animal_uuid?: string | null;
}

export interface CorralWorkSessionDto {
  uuid_corral_work_session: string;
  ranch_uuid: string;
  work_date: string;
  status: CorralWorkSessionStatus;
  notes?: string | null;
  responsible_person?: string | null;
  created_by?: string | null;
  started_at?: string | null;
  closed_at?: string | null;
  steps?: CorralSessionStepDto[];
  sources?: CorralSessionSourceDto[];
  planned_activities?: CorralActivityCode[];
  animal_count?: number;
  animals_loaded?: boolean;
  work_configured?: boolean;
  requires_animal_load?: boolean;
}

export interface CorralStepGridColumnDto {
  activity_code: CorralActivityCode;
  column_key: string;
  label: string;
  value_type: 'boolean' | 'number' | 'text' | 'medicine';
}

export interface CorralStepGridRowDto {
  animal_uuid: string;
  registration_number: string;
  chip_number?: string | null;
  values: Record<string, string | number | boolean | string[] | null>;
}

export interface CorralStepGridDto {
  uuid_corral_session_step: string;
  step_order: number;
  label?: string | null;
  work_mode?: CorralStepWorkMode;
  columns: CorralStepGridColumnDto[];
  rows: CorralStepGridRowDto[];
  animal_count?: number;
}

export interface CorralSessionWorkspaceDto {
  session: CorralWorkSessionDto & { animal_count: number };
  grids: CorralStepGridDto[];
  findings_summary_count: number;
}

export interface SaveCorralStepGridPayload {
  rows: Array<{
    animal_uuid: string;
    values: Record<string, string | number | boolean | string[] | null>;
  }>;
}

export interface UpsertCorralFindingPayload {
  animal_uuid: string;
  uuid_corral_session_step?: string | null;
  observation_text?: string | null;
  condition_code?: CorralVisualConditionCode | null;
  additional_medications?: Array<{
    product_name: string;
    medicine_uuid?: string | null;
    dose?: string | null;
    unit?: string | null;
  }>;
  additional_treatments?: Array<{
    treatment_type: string;
    description?: string | null;
  }>;
}

export interface AnimalLookupDto {
  animal_uuid: string;
  registration_number: string;
  chip_number?: string | null;
}
