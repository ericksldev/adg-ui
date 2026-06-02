import { AnimalCreatePayload } from './animal-create-payload.model';

export interface AnimalBatchCreateRowInput {
  index: number;
  animal: AnimalCreatePayload;
}

export interface AnimalBatchCreateRequestBody {
  rows: AnimalBatchCreateRowInput[];
}

export interface AnimalBatchRowResultDto {
  index: number;
  success: boolean;
  animal_uuid?: string;
  error?: string;
}

export interface AnimalBatchCreateResultDto {
  created: number;
  failed: number;
  results: AnimalBatchRowResultDto[];
}
