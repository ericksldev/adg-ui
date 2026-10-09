export function animalStatusLabelKey(status?: string | null): string {
  const map: Record<string, string> = {
    ACTIVE: 'animal.statusActive',
    SOLD: 'animal.statusSold',
    DISPOSED: 'animal.statusDisposed',
    DEAD: 'animal.statusDead',
    MISSING: 'animal.statusMissing',
    INACTIVE: 'animal.statusInactive'
  };
  return map[status ?? ''] ?? 'animal.statusActive';
}

export function animalBreedLabelKey(code?: string | null): string {
  const normalized = String(code ?? '').trim().toUpperCase();
  if (!normalized) {
    return 'common.notAvailable';
  }
  return `animal.breed.${normalized}`;
}

export function animalExitTypeLabelKey(exitType?: string | null): string {
  const map: Record<string, string> = {
    SALE: 'animal.exitTypeSale',
    DEATH: 'animal.exitTypeDeath',
    DISPOSED: 'animal.exitTypeDisposed',
    MISSING: 'animal.exitTypeMissing',
    OTHER: 'animal.exitTypeOther'
  };
  return map[exitType ?? ''] ?? 'animal.exitTypeOther';
}

export function animalOriginLabelKey(origin?: string | null): string {
  const map: Record<string, string> = {
    BIRTH: 'animal.originBirth',
    PURCHASE: 'animal.originPurchase',
    TRANSFER: 'animal.originTransfer',
    UNKNOWN: 'animal.originUnknown'
  };
  return map[origin ?? ''] ?? 'animal.originUnknown';
}

export interface AnimalAgeParts {
  years: number;
  months: number;
}

/** Completed age from a birth date, using UTC calendar days to match inventory date display. */
export function animalAgeParts(birthDate?: string | Date | null, now: Date = new Date()): AnimalAgeParts | null {
  if (!birthDate) {
    return null;
  }
  const birth = birthDate instanceof Date ? birthDate : new Date(birthDate);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  let years = now.getUTCFullYear() - birth.getUTCFullYear();
  let months = now.getUTCMonth() - birth.getUTCMonth();
  const dayDelta = now.getUTCDate() - birth.getUTCDate();
  if (dayDelta < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) {
    return { years: 0, months: 0 };
  }
  return { years, months };
}
