import { Injectable } from '@angular/core';
import {
  CorralAnimalListSortMode,
  isCorralAnimalListSortMode
} from '../models/corral-animal-list-sort.model';

const STORAGE_KEY = 'corral-animal-list-sort';
const DEFAULT_KEY = 'default';
const DEFAULT_SORT: CorralAnimalListSortMode = 'SCAN_ORDER';

@Injectable({
  providedIn: 'root'
})
export class CorralAnimalListSortService {
  getSort(activityCode?: string | null): CorralAnimalListSortMode {
    const stored = this.readAll();
    const scoped = activityCode ? stored[activityCode] : undefined;
    return scoped ?? stored[DEFAULT_KEY] ?? DEFAULT_SORT;
  }

  setSort(mode: CorralAnimalListSortMode, activityCode?: string | null): void {
    const stored = this.readAll();
    stored[DEFAULT_KEY] = mode;
    if (activityCode) {
      stored[activityCode] = mode;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Preference stays in memory for this session.
    }
  }

  private readAll(): Record<string, CorralAnimalListSortMode> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const stored: Record<string, CorralAnimalListSortMode> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (!isCorralAnimalListSortMode(value)) {
          continue;
        }
        stored[key === '_default' ? DEFAULT_KEY : key] = value;
      }
      return stored;
    } catch {
      return {};
    }
  }
}
