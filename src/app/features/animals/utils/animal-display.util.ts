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
