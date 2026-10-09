import { Injectable } from '@angular/core';
import { SessionService } from 'src/app/core/services/session.service';
import { readLocalStorageMigrating } from 'src/app/core/utils/legacy-local-storage';
import {
  ANIMAL_BATCH_DEACTIVATE_COLUMNS_STORAGE_PREFIX,
  ANIMAL_BATCH_DEACTIVATE_COLUMNS_STORAGE_PREFIX_LEGACY,
  ANIMAL_BATCH_DEACTIVATE_DEFAULT_COLUMN_VISIBILITY,
  AnimalBatchDeactivateDisplayColumnKey
} from '../constants/animal-batch-deactivate.constants';

@Injectable({
  providedIn: 'root'
})
export class AnimalBatchDeactivatePreferencesService {
  constructor(private readonly sessionService: SessionService) {}

  loadColumnVisibility(): Record<AnimalBatchDeactivateDisplayColumnKey, boolean> {
    const key = this.storageKey(ANIMAL_BATCH_DEACTIVATE_COLUMNS_STORAGE_PREFIX);
    const legacyKey = this.storageKey(ANIMAL_BATCH_DEACTIVATE_COLUMNS_STORAGE_PREFIX_LEGACY);
    if (!key || !legacyKey) {
      return { ...ANIMAL_BATCH_DEACTIVATE_DEFAULT_COLUMN_VISIBILITY };
    }
    const raw = readLocalStorageMigrating(key, legacyKey);
    if (!raw) {
      return { ...ANIMAL_BATCH_DEACTIVATE_DEFAULT_COLUMN_VISIBILITY };
    }
    try {
      const parsed = JSON.parse(raw) as Partial<Record<AnimalBatchDeactivateDisplayColumnKey, boolean>>;
      return { ...ANIMAL_BATCH_DEACTIVATE_DEFAULT_COLUMN_VISIBILITY, ...parsed };
    } catch {
      return { ...ANIMAL_BATCH_DEACTIVATE_DEFAULT_COLUMN_VISIBILITY };
    }
  }

  saveColumnVisibility(visibility: Record<AnimalBatchDeactivateDisplayColumnKey, boolean>): void {
    const key = this.storageKey(ANIMAL_BATCH_DEACTIVATE_COLUMNS_STORAGE_PREFIX);
    if (!key) {
      return;
    }
    localStorage.setItem(key, JSON.stringify(visibility));
  }

  private storageKey(prefix: string): string | null {
    const company = this.sessionService.getUuidCompany();
    const username = this.sessionService.getUsername();
    if (!company?.trim() || !username?.trim()) {
      return null;
    }
    return `${prefix}_${company}_${username}`;
  }
}
