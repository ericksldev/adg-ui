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
  value_type: 'boolean' | 'number' | 'text' | 'medicine' | 'paddock_current' | 'paddock_destination';
}

export interface CorralStepGridRowDto {
  animal_uuid: string;
  registration_number: string;
  chip_number?: string | null;
  missing_inventory?: boolean;
  current_paddock_uuid?: string | null;
  current_paddock_name?: string | null;
  session_origin_paddock_name?: string | null;
  session_destination_paddock_name?: string | null;
  values: Record<string, string | number | boolean | string[] | null>;
}

export interface PaddockDistributionMovePayload {
  animal_uuid: string;
  destination_paddock_uuid: string;
}

export interface PaddockCapacityWarningDto {
  paddock_uuid: string;
  paddock_name: string;
  maximum_capacity: number;
  projected_count: number;
}

export interface ApplyPaddockDistributionResultDto {
  moved_count: number;
  capacity_warnings: PaddockCapacityWarningDto[];
  session_status: CorralWorkSessionStatus;
  grid: CorralStepGridDto;
}

export interface CorralStepGridDto {
  uuid_corral_session_step: string;
  step_order: number;
  label?: string | null;
  work_mode?: CorralStepWorkMode;
  columns: CorralStepGridColumnDto[];
  rows: CorralStepGridRowDto[];
  animal_count?: number;
  scanned_animal_uuids?: string[];
}

export interface CorralSessionWorkspaceDto {
  session: CorralWorkSessionDto & { animal_count: number };
  grids: CorralStepGridDto[];
  findings_summary_count: number;
}

export interface SaveCorralStepGridPayload {
  rows: Array<{
    animal_uuid: string;
    registration_number?: string;
    missing_inventory?: boolean;
    values: Record<string, string | number | boolean | string[] | null>;
  }>;
  scanned_animal_uuids?: string[];
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

export interface AnimalCorralWorkHistoryActivityDto {
  activity_code: string;
  values: string[];
}

export interface AnimalCorralWorkHistorySessionDto {
  uuid_corral_work_session: string;
  work_date: string;
  status: CorralWorkSessionStatus;
  responsible_person?: string | null;
  activities: AnimalCorralWorkHistoryActivityDto[];
  observations: string[];
  condition_codes: CorralVisualConditionCode[];
  medications: string[];
  treatments: string[];
}

export interface AnimalCorralProfileDto {
  animal_uuid: string;
  registration_number: string;
  chip_number?: string | null;
  sex: string;
  breed_code?: string | null;
  color?: string | null;
  birth_date: string;
  origin_type: string;
  paddock_name?: string | null;
}

export interface PendingAnimalRegistrationSessionDto {
  uuid_corral_work_session: string;
  work_date: string;
  responsible_person: string | null;
  status: string;
}

export interface PendingAnimalRegistrationDto {
  registration_number: string;
  ranch_uuid: string;
  first_seen_at: string;
  last_seen_at: string;
  sessions: PendingAnimalRegistrationSessionDto[];
}

export interface AnimalCorralWorkHistoryDto {
  animal_uuid: string;
  registration_number: string;
  chip_number?: string | null;
  profile: AnimalCorralProfileDto;
  sessions: AnimalCorralWorkHistorySessionDto[];
}
