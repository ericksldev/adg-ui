import { Injectable } from '@angular/core';
import { SessionService } from 'src/app/core/services/session.service';
import { readLocalStorageMigrating } from 'src/app/core/utils/legacy-local-storage';
import {
  ANIMAL_LIST_BIRTH_DISPLAY_STORAGE_PREFIX,
  ANIMAL_LIST_BIRTH_DISPLAY_STORAGE_PREFIX_LEGACY,
  ANIMAL_LIST_COLUMNS_STORAGE_PREFIX,
  ANIMAL_LIST_COLUMNS_STORAGE_PREFIX_LEGACY,
  ANIMAL_LIST_DEFAULT_BIRTH_DISPLAY,
  ANIMAL_LIST_DEFAULT_OPTIONAL_VISIBILITY,
  ANIMAL_LIST_DEFAULT_PAGE_SIZE,
  ANIMAL_LIST_PAGE_SIZE_OPTIONS,
  ANIMAL_LIST_PAGE_SIZE_STORAGE_PREFIX,
  ANIMAL_LIST_PAGE_SIZE_STORAGE_PREFIX_LEGACY,
  AnimalBirthDisplayMode,
  AnimalListOptionalColumnKey
} from '../constants/animal-list.constants';

@Injectable({
  providedIn: 'root'
})
export class AnimalListPreferencesService {
  constructor(private readonly sessionService: SessionService) {}

  loadOptionalColumnVisibility(): Record<AnimalListOptionalColumnKey, boolean> {
    const raw = this.readScoped(ANIMAL_LIST_COLUMNS_STORAGE_PREFIX, ANIMAL_LIST_COLUMNS_STORAGE_PREFIX_LEGACY);
    if (!raw) {
      return { ...ANIMAL_LIST_DEFAULT_OPTIONAL_VISIBILITY };
    }
    try {
      const parsed = JSON.parse(raw) as Partial<Record<AnimalListOptionalColumnKey, boolean>>;
      return { ...ANIMAL_LIST_DEFAULT_OPTIONAL_VISIBILITY, ...parsed };
    } catch {
      return { ...ANIMAL_LIST_DEFAULT_OPTIONAL_VISIBILITY };
    }
  }

  saveOptionalColumnVisibility(visibility: Record<AnimalListOptionalColumnKey, boolean>): void {
    const key = this.columnsStorageKey();
    if (!key) {
      return;
    }
    localStorage.setItem(key, JSON.stringify(visibility));
  }

  loadPageSize(): number {
    const raw = this.readScoped(ANIMAL_LIST_PAGE_SIZE_STORAGE_PREFIX, ANIMAL_LIST_PAGE_SIZE_STORAGE_PREFIX_LEGACY);
    if (!raw) {
      return ANIMAL_LIST_DEFAULT_PAGE_SIZE;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || !ANIMAL_LIST_PAGE_SIZE_OPTIONS.includes(parsed)) {
      return ANIMAL_LIST_DEFAULT_PAGE_SIZE;
    }
    return parsed;
  }

  savePageSize(size: number): void {
    const key = this.pageSizeStorageKey();
    if (!key || !ANIMAL_LIST_PAGE_SIZE_OPTIONS.includes(size)) {
      return;
    }
    localStorage.setItem(key, String(size));
  }

  loadBirthDisplayMode(): AnimalBirthDisplayMode {
    const raw = this.readScoped(
      ANIMAL_LIST_BIRTH_DISPLAY_STORAGE_PREFIX,
      ANIMAL_LIST_BIRTH_DISPLAY_STORAGE_PREFIX_LEGACY
    );
    return raw === 'age' || raw === 'date' ? raw : ANIMAL_LIST_DEFAULT_BIRTH_DISPLAY;
  }

  saveBirthDisplayMode(mode: AnimalBirthDisplayMode): void {
    const key = this.birthDisplayStorageKey();
    if (!key) {
      return;
    }
    localStorage.setItem(key, mode);
  }

  private columnsStorageKey(): string | null {
    return this.userScopedKey(ANIMAL_LIST_COLUMNS_STORAGE_PREFIX);
  }

  private pageSizeStorageKey(): string | null {
    return this.userScopedKey(ANIMAL_LIST_PAGE_SIZE_STORAGE_PREFIX);
  }

  private birthDisplayStorageKey(): string | null {
    return this.userScopedKey(ANIMAL_LIST_BIRTH_DISPLAY_STORAGE_PREFIX);
  }

  private userScopedKey(prefix: string): string | null {
    const company = this.sessionService.getUuidCompany();
    const username = this.sessionService.getUsername();
    if (!company?.trim() || !username?.trim()) {
      return null;
    }
    return `${prefix}_${company}_${username}`;
  }

  private readScoped(prefix: string, legacyPrefix: string): string | null {
    const key = this.userScopedKey(prefix);
    const legacyKey = this.userScopedKey(legacyPrefix);
    if (!key || !legacyKey) {
      return null;
    }
    return readLocalStorageMigrating(key, legacyKey);
  }
}
