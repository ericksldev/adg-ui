import { AnimalExitType } from '../constants/animal-exit.constants';

export interface AnimalLastExit {
  disposal_uuid: string;
  exit_type: string;
  exit_date: string;
  reason?: string | null;
  description?: string | null;
}

export interface AnimalDeactivatePayload {
  exit_type: AnimalExitType;
  exit_date: string;
  reason?: string | null;
  description?: string | null;
}

export interface AnimalDeactivateBatchRowResult {
  animal_uuid: string;
  success: boolean;
  error?: string;
}

export interface AnimalDeactivateBatchResult {
  requested: number;
  success: number;
  failed: number;
  rows: AnimalDeactivateBatchRowResult[];
}
