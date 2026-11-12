import { Injectable } from '@angular/core';
import { normalizeStepFindingPresets, StepFindingPresets } from '../models/corral-finding-presets.model';
import {
  createEmptyStepGridColumnPresets,
  normalizeStepGridColumnPresets,
  StepGridColumnPresets
} from '../models/corral-grid-column-presets.model';

const GRID_STORAGE_KEY = 'corral-grid-presets-store';
const FINDING_STORAGE_KEY = 'corral-finding-presets-store';

interface PresetStore<T> {
  sessions: Record<string, T>;
  catalog: Record<string, T>;
}

@Injectable({
  providedIn: 'root'
})
export class CorralStepPresetStorageService {
  getGridPresets(
    sessionUuid: string,
    stepUuid: string,
    ranchUuid: string,
    columnKeys: string[]
  ): StepGridColumnPresets {
    const store = this.readGridStore();
    const sessionKey = this.sessionKey(sessionUuid, stepUuid);
    const sessionPresets =
      store.sessions[sessionKey] ?? this.migrateLegacyGrid(sessionUuid, stepUuid);
    if (!this.isEmptyGrid(sessionPresets)) {
      return this.cloneGrid(sessionPresets);
    }

    const catalog = store.catalog[this.catalogKey(ranchUuid)];
    if (!catalog) {
      return createEmptyStepGridColumnPresets();
    }

    const filtered: StepGridColumnPresets = createEmptyStepGridColumnPresets();
    for (const columnKey of columnKeys) {
      const entries = catalog[columnKey];
      if (entries?.length) {
        filtered[columnKey] = entries.map((entry) => ({ ...entry }));
      }
    }
    return filtered;
  }

  setGridPresets(
    sessionUuid: string,
    stepUuid: string,
    ranchUuid: string,
    presets: StepGridColumnPresets
  ): void {
    const store = this.readGridStore();
    const cloned = this.cloneGrid(presets);
    store.sessions[this.sessionKey(sessionUuid, stepUuid)] = cloned;
    store.catalog[this.catalogKey(ranchUuid)] = this.mergeGrid(
      store.catalog[this.catalogKey(ranchUuid)],
      cloned
    );
    this.writeGridStore(store);
  }

  getFindingPresets(sessionUuid: string, stepUuid: string, ranchUuid: string): StepFindingPresets {
    const store = this.readFindingStore();
    const sessionKey = this.sessionKey(sessionUuid, stepUuid);
    const sessionPresets =
      store.sessions[sessionKey] ?? this.migrateLegacyFindings(sessionUuid, stepUuid);
    if (!this.isEmptyFindings(sessionPresets)) {
      return normalizeStepFindingPresets(sessionPresets);
    }
    return normalizeStepFindingPresets(store.catalog[this.catalogKey(ranchUuid)]);
  }

  setFindingPresets(
    sessionUuid: string,
    stepUuid: string,
    ranchUuid: string,
    presets: StepFindingPresets
  ): void {
    const store = this.readFindingStore();
    const normalized = normalizeStepFindingPresets(presets);
    store.sessions[this.sessionKey(sessionUuid, stepUuid)] = normalized;
    store.catalog[this.catalogKey(ranchUuid)] = normalized;
    this.writeFindingStore(store);
  }

  private migrateLegacyGrid(sessionUuid: string, stepUuid: string): StepGridColumnPresets | undefined {
    try {
      const raw = sessionStorage.getItem(`corral-grid-presets:${sessionUuid}:${stepUuid}`);
      if (!raw) return undefined;
      const presets = normalizeStepGridColumnPresets(JSON.parse(raw));
      if (this.isEmptyGrid(presets)) return undefined;
      const store = this.readGridStore();
      store.sessions[this.sessionKey(sessionUuid, stepUuid)] = presets;
      this.writeGridStore(store);
      return presets;
    } catch {
      return undefined;
    }
  }

  private migrateLegacyFindings(
    sessionUuid: string,
    stepUuid: string
  ): StepFindingPresets | undefined {
    try {
      const raw = sessionStorage.getItem(`corral-finding-presets:${sessionUuid}:${stepUuid}`);
      if (!raw) return undefined;
      const presets = normalizeStepFindingPresets(JSON.parse(raw));
      if (this.isEmptyFindings(presets)) return undefined;
      const store = this.readFindingStore();
      store.sessions[this.sessionKey(sessionUuid, stepUuid)] = presets;
      this.writeFindingStore(store);
      return presets;
    } catch {
      return undefined;
    }
  }

  private readGridStore(): PresetStore<StepGridColumnPresets> {
    return this.readStore(GRID_STORAGE_KEY, (raw) => normalizeStepGridColumnPresets(raw));
  }

  private writeGridStore(store: PresetStore<StepGridColumnPresets>): void {
    this.writeStore(GRID_STORAGE_KEY, store);
  }

  private readFindingStore(): PresetStore<StepFindingPresets> {
    return this.readStore(FINDING_STORAGE_KEY, (raw) => normalizeStepFindingPresets(raw));
  }

  private writeFindingStore(store: PresetStore<StepFindingPresets>): void {
    this.writeStore(FINDING_STORAGE_KEY, store);
  }

  private readStore<T>(key: string, normalize: (raw: unknown) => T): PresetStore<T> {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return { sessions: {}, catalog: {} };
      }
      const parsed = JSON.parse(raw) as Partial<PresetStore<unknown>>;
      return {
        sessions: this.normalizeMap(parsed.sessions, normalize),
        catalog: this.normalizeMap(parsed.catalog, normalize)
      };
    } catch {
      return { sessions: {}, catalog: {} };
    }
  }

  private writeStore<T>(key: string, store: PresetStore<T>): void {
    try {
      localStorage.setItem(key, JSON.stringify(store));
    } catch {
      // Preference stays in memory when storage is unavailable.
    }
  }

  private normalizeMap<T>(raw: unknown, normalize: (value: unknown) => T): Record<string, T> {
    if (!raw || typeof raw !== 'object') return {};
    const result: Record<string, T> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      result[key] = normalize(value);
    }
    return result;
  }

  private sessionKey(sessionUuid: string, stepUuid: string): string {
    return `${sessionUuid}:${stepUuid}`;
  }

  private catalogKey(ranchUuid: string): string {
    return ranchUuid.trim() || 'default';
  }

  private isEmptyGrid(presets: StepGridColumnPresets | undefined): boolean {
    if (!presets) return true;
    return Object.values(presets).every((entries) => !entries || entries.length === 0);
  }

  private isEmptyFindings(presets: StepFindingPresets | undefined): boolean {
    if (!presets) return true;
    return (
      presets.observations.length === 0 &&
      presets.conditions.length === 0 &&
      presets.medications.length === 0
    );
  }

  private cloneGrid(presets: StepGridColumnPresets): StepGridColumnPresets {
    const cloned: StepGridColumnPresets = createEmptyStepGridColumnPresets();
    for (const [key, entries] of Object.entries(presets)) {
      cloned[key] = (entries ?? []).map((entry) => ({ ...entry }));
    }
    return cloned;
  }

  private mergeGrid(
    current: StepGridColumnPresets | undefined,
    incoming: StepGridColumnPresets
  ): StepGridColumnPresets {
    const merged = this.cloneGrid(current ?? createEmptyStepGridColumnPresets());
    for (const [key, entries] of Object.entries(incoming)) {
      if (!entries || entries.length === 0) {
        delete merged[key];
        continue;
      }
      merged[key] = entries.map((entry) => ({ ...entry }));
    }
    return merged;
  }
}
