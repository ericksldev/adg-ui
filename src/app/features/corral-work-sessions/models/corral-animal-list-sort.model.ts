export const CORRAL_ANIMAL_LIST_SORT_MODES = [
  'SCAN_ORDER',
  'REGISTRATION_ASC',
  'REGISTRATION_DESC'
] as const;

export type CorralAnimalListSortMode = (typeof CORRAL_ANIMAL_LIST_SORT_MODES)[number];

export function isCorralAnimalListSortMode(value: unknown): value is CorralAnimalListSortMode {
  return CORRAL_ANIMAL_LIST_SORT_MODES.includes(value as CorralAnimalListSortMode);
}

export function compareRegistrationNumbers(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

export function orderWorkingRows<T extends { animal_uuid: string; registration_number: string }>(
  rows: T[],
  options: {
    mode: CorralAnimalListSortMode;
    pinnedUuid?: string | null;
    newestFirstScanUuids?: string[];
  }
): T[] {
  if (rows.length <= 1) {
    return [...rows];
  }

  const pinnedUuid = options.pinnedUuid || null;
  const pinned = pinnedUuid ? rows.find((row) => row.animal_uuid === pinnedUuid) : undefined;
  const rest = pinned ? rows.filter((row) => row.animal_uuid !== pinned.animal_uuid) : [...rows];

  return pinned ? [pinned, ...sortRest(rest, options)] : sortRest(rest, options);
}

function sortRest<T extends { animal_uuid: string; registration_number: string }>(
  rows: T[],
  options: {
    mode: CorralAnimalListSortMode;
    newestFirstScanUuids?: string[];
  }
): T[] {
  if (options.mode === 'REGISTRATION_ASC') {
    return [...rows].sort((a, b) => compareRegistrationNumbers(a.registration_number, b.registration_number));
  }
  if (options.mode === 'REGISTRATION_DESC') {
    return [...rows].sort((a, b) => compareRegistrationNumbers(b.registration_number, a.registration_number));
  }

  const newestFirst = options.newestFirstScanUuids ?? [];
  const oldestFirstIndex = new Map(
    [...newestFirst].reverse().map((uuid, index) => [uuid, index])
  );
  return [...rows].sort((a, b) => {
    const aIndex = oldestFirstIndex.get(a.animal_uuid);
    const bIndex = oldestFirstIndex.get(b.animal_uuid);
    const aRank = aIndex === undefined ? Number.MAX_SAFE_INTEGER : aIndex;
    const bRank = bIndex === undefined ? Number.MAX_SAFE_INTEGER : bIndex;
    if (aRank !== bRank) {
      return aRank - bRank;
    }
    return compareRegistrationNumbers(a.registration_number, b.registration_number);
  });
}
