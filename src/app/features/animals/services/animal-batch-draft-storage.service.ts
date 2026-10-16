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

const DRAFT_DB_NAME = 'vrete-animal-batch';
const DRAFT_DB_STORE = 'drafts';

function isDraftRow(value: unknown): value is AnimalBatchDraftRow {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const row = value as Record<string, unknown>;
  return ANIMAL_BATCH_DRAFT_ROW_KEYS.every((key) => typeof row[key as string] === 'string');
}

function asSnapshot(value: unknown): AnimalBatchDraftSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const parsed = value as Partial<AnimalBatchDraftSnapshot>;
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
}

@Injectable({
  providedIn: 'root'
})
export class AnimalBatchDraftStorageService {
  private database: Promise<IDBDatabase | null> | null = null;

  constructor(private readonly sessionService: SessionService) {}

  private storageKey(prefix: string): string | null {
    const company = this.sessionService.getUuidCompany();
    const username = this.sessionService.getUsername();
    if (!company?.trim() || !username?.trim()) {
      return null;
    }
    return `${prefix}_${company}_${username}`;
  }

  async load(): Promise<AnimalBatchDraftSnapshot | null> {
    const key = this.storageKey(ANIMAL_BATCH_STORAGE_PREFIX);
    const legacyKey = this.storageKey(ANIMAL_BATCH_STORAGE_PREFIX_LEGACY);
    if (!key || !legacyKey) {
      return null;
    }

    const fromDatabase = await this.readDatabase(key);
    if (fromDatabase) {
      this.removeLocal(key, legacyKey);
      return fromDatabase;
    }

    const raw = readLocalStorageMigrating(key, legacyKey);
    if (!raw) {
      return null;
    }
    try {
      const parsed = asSnapshot(JSON.parse(raw) as unknown);
      if (!parsed) {
        this.removeLocal(key, legacyKey);
        return null;
      }
      await this.writeDatabase(key, parsed);
      this.removeLocal(key, legacyKey);
      return parsed;
    } catch {
      this.removeLocal(key, legacyKey);
      return null;
    }
  }

  save(snapshot: AnimalBatchDraftSnapshot): void {
    const key = this.storageKey(ANIMAL_BATCH_STORAGE_PREFIX);
    const legacyKey = this.storageKey(ANIMAL_BATCH_STORAGE_PREFIX_LEGACY);
    if (!key || !legacyKey) {
      return;
    }
    void this.writeDatabase(key, snapshot)
      .then((stored) => {
        if (stored) {
          this.removeLocal(key, legacyKey);
          return;
        }
        this.writeLocal(key, snapshot);
      })
      .catch(() => this.writeLocal(key, snapshot));
  }

  clear(): void {
    const key = this.storageKey(ANIMAL_BATCH_STORAGE_PREFIX);
    const legacyKey = this.storageKey(ANIMAL_BATCH_STORAGE_PREFIX_LEGACY);
    if (!key || !legacyKey) {
      return;
    }
    void this.deleteDatabase(key);
    this.removeLocal(key, legacyKey);
  }

  private removeLocal(key: string, legacyKey: string): void {
    removeLocalStorageWithLegacy(key, legacyKey);
  }

  private writeLocal(key: string, snapshot: AnimalBatchDraftSnapshot): void {
    try {
      localStorage.setItem(key, JSON.stringify(snapshot));
    } catch {
      // Quota exceeded. The in-memory grid stays usable for this session.
    }
  }

  private openDatabase(): Promise<IDBDatabase | null> {
    if (this.database) {
      return this.database;
    }
    if (typeof indexedDB === 'undefined') {
      this.database = Promise.resolve(null);
      return this.database;
    }
    this.database = new Promise((resolve) => {
      const request = indexedDB.open(DRAFT_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DRAFT_DB_STORE)) {
          db.createObjectStore(DRAFT_DB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
    return this.database;
  }

  private async readDatabase(key: string): Promise<AnimalBatchDraftSnapshot | null> {
    const db = await this.openDatabase();
    if (!db) {
      return null;
    }
    return new Promise((resolve) => {
      const request = db.transaction(DRAFT_DB_STORE, 'readonly').objectStore(DRAFT_DB_STORE).get(key);
      request.onsuccess = () => resolve(asSnapshot(request.result));
      request.onerror = () => resolve(null);
    });
  }

  private async writeDatabase(key: string, snapshot: AnimalBatchDraftSnapshot): Promise<boolean> {
    const db = await this.openDatabase();
    if (!db) {
      return false;
    }
    return new Promise((resolve) => {
      const request = db.transaction(DRAFT_DB_STORE, 'readwrite').objectStore(DRAFT_DB_STORE).put(snapshot, key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }

  private async deleteDatabase(key: string): Promise<void> {
    const db = await this.openDatabase();
    if (!db) {
      return;
    }
    await new Promise<void>((resolve) => {
      const request = db.transaction(DRAFT_DB_STORE, 'readwrite').objectStore(DRAFT_DB_STORE).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }
}
