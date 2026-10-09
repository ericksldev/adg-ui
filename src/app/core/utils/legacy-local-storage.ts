/**
 * Reads `key`. If it is empty and `legacyKey` has a value, copies that value
 * into `key` and removes `legacyKey` so existing browsers keep their data.
 */
export function readLocalStorageMigrating(key: string, legacyKey: string): string | null {
  const current = localStorage.getItem(key);
  if (current !== null) {
    return current;
  }

  const legacy = localStorage.getItem(legacyKey);
  if (legacy === null) {
    return null;
  }

  localStorage.setItem(key, legacy);
  localStorage.removeItem(legacyKey);
  return legacy;
}

export function removeLocalStorageWithLegacy(key: string, legacyKey: string): void {
  localStorage.removeItem(key);
  localStorage.removeItem(legacyKey);
}
