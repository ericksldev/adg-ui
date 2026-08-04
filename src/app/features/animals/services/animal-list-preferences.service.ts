import { Injectable } from '@angular/core';
import { SessionService } from 'src/app/core/services/session.service';
import {
  ANIMAL_LIST_COLUMNS_STORAGE_PREFIX,
  ANIMAL_LIST_DEFAULT_OPTIONAL_VISIBILITY,
  ANIMAL_LIST_DEFAULT_PAGE_SIZE,
  ANIMAL_LIST_PAGE_SIZE_OPTIONS,
  ANIMAL_LIST_PAGE_SIZE_STORAGE_PREFIX,
  AnimalListOptionalColumnKey
} from '../constants/animal-list.constants';

@Injectable({
  providedIn: 'root'
})
export class AnimalListPreferencesService {
  constructor(private readonly sessionService: SessionService) {}

  loadOptionalColumnVisibility(): Record<AnimalListOptionalColumnKey, boolean> {
    const key = this.columnsStorageKey();
    if (!key) {
      return { ...ANIMAL_LIST_DEFAULT_OPTIONAL_VISIBILITY };
    }
    const raw = localStorage.getItem(key);
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
    const key = this.pageSizeStorageKey();
    if (!key) {
      return ANIMAL_LIST_DEFAULT_PAGE_SIZE;
    }
    const raw = localStorage.getItem(key);
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

  private columnsStorageKey(): string | null {
    return this.userScopedKey(ANIMAL_LIST_COLUMNS_STORAGE_PREFIX);
  }

  private pageSizeStorageKey(): string | null {
    return this.userScopedKey(ANIMAL_LIST_PAGE_SIZE_STORAGE_PREFIX);
  }

  private userScopedKey(prefix: string): string | null {
    const company = this.sessionService.getUuidCompany();
    const username = this.sessionService.getUsername();
    if (!company?.trim() || !username?.trim()) {
      return null;
    }
    return `${prefix}_${company}_${username}`;
  }
}
