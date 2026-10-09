import { Injectable } from '@angular/core';
import { SessionService } from 'src/app/core/services/session.service';
import { readLocalStorageMigrating, removeLocalStorageWithLegacy } from 'src/app/core/utils/legacy-local-storage';
import { ANIMAL_BATCH_STORAGE_PREFIX, ANIMAL_BATCH_STORAGE_PREFIX_LEGACY } from '../constants/animal-batch.constants';
import {
  ANIMAL_BATCH_DRAFT_ROW_KEYS,
  ANIMAL_BATCH_DRAFT_VERSION,
  AnimalBatchDraftRow,
  AnimalBatchDraftSnapshot
} from '../models/animal-batch-draft.model';

function isDraftRow(value: unknown): value is AnimalBatchDraftRow {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const row = value as Record<string, unknown>;
  return ANIMAL_BATCH_DRAFT_ROW_KEYS.every((key) => typeof row[key as string] === 'string');
}

@Injectable({
  providedIn: 'root'
})
export class AnimalBatchDraftStorageService {
  constructor(private readonly sessionService: SessionService) {}

  private storageKey(prefix: string): string | null {
    const company = this.sessionService.getUuidCompany();
    const username = this.sessionService.getUsername();
    if (!company?.trim() || !username?.trim()) {
      return null;
    }
    return `${prefix}_${company}_${username}`;
  }

  load(): AnimalBatchDraftSnapshot | null {
    const key = this.storageKey(ANIMAL_BATCH_STORAGE_PREFIX);
    const legacyKey = this.storageKey(ANIMAL_BATCH_STORAGE_PREFIX_LEGACY);
    if (!key || !legacyKey) {
      return null;
    }
    const raw = readLocalStorageMigrating(key, legacyKey);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<AnimalBatchDraftSnapshot>;
      if (
        parsed.version !== ANIMAL_BATCH_DRAFT_VERSION ||
        typeof parsed.rowSlotCount !== 'number' ||
        !Array.isArray(parsed.rows) ||
        parsed.rows.length === 0 ||
        !parsed.rows.every(isDraftRow)
      ) {
        return null;
      }
      return parsed as AnimalBatchDraftSnapshot;
    } catch {
      return null;
    }
  }

  save(snapshot: AnimalBatchDraftSnapshot): void {
    const key = this.storageKey(ANIMAL_BATCH_STORAGE_PREFIX);
    if (!key) {
      return;
    }
    localStorage.setItem(key, JSON.stringify(snapshot));
  }

  clear(): void {
    const key = this.storageKey(ANIMAL_BATCH_STORAGE_PREFIX);
    const legacyKey = this.storageKey(ANIMAL_BATCH_STORAGE_PREFIX_LEGACY);
    if (!key || !legacyKey) {
      return;
    }
    removeLocalStorageWithLegacy(key, legacyKey);
  }
}
