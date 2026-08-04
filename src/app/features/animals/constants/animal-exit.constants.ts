import { AnimalCurrentStatus } from '../models/animal-api-fields.model';

export const ANIMAL_EXIT_TYPES = ['SALE', 'DEATH', 'DISPOSED', 'MISSING', 'OTHER'] as const;

export type AnimalExitType = (typeof ANIMAL_EXIT_TYPES)[number];

export interface AnimalExitTypeOption {
  value: AnimalExitType;
  labelKey: string;
  status: AnimalCurrentStatus;
}

export const ANIMAL_EXIT_TYPE_OPTIONS: readonly AnimalExitTypeOption[] = [
  { value: 'SALE', labelKey: 'animal.exitTypeSale', status: 'SOLD' },
  { value: 'DEATH', labelKey: 'animal.exitTypeDeath', status: 'DEAD' },
  { value: 'DISPOSED', labelKey: 'animal.exitTypeDisposed', status: 'DISPOSED' },
  { value: 'MISSING', labelKey: 'animal.exitTypeMissing', status: 'MISSING' },
  { value: 'OTHER', labelKey: 'animal.exitTypeOther', status: 'INACTIVE' }
] as const;

export function animalExitTypeLabelKey(exitType?: string | null): string {
  const found = ANIMAL_EXIT_TYPE_OPTIONS.find((o) => o.value === exitType);
  return found?.labelKey ?? 'animal.exitTypeOther';
}
