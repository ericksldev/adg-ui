import { AnimalExitType } from '../constants/animal-exit.constants';

/** Row in the batch deactivation draft table (UI state). */
export interface AnimalDeactivateDraftRow {
  animal_uuid: string;
  registration_number: string;
  breed_code?: string | null;
  sex: string;
  exit_type: AnimalExitType;
  exit_date: string;
  reason: string;
  description: string;
}

export interface AnimalDeactivateBatchRowPayload {
  animal_uuid: string;
  exit_type: AnimalExitType;
  exit_date: string;
  reason?: string | null;
  description?: string | null;
}

export interface AnimalDeactivateBatchPayload {
  rows: AnimalDeactivateBatchRowPayload[];
}
