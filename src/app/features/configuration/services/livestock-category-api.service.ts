import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  AnimalCategoryAssignment,
  AnimalCategoryHistoryEntry,
  LivestockCategory
} from '../models/livestock-category.model';

interface ApiItem<T> {
  success: boolean;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class LivestockCategoryApiService {
  private readonly baseUrl = `${environment.urlApi}/livestock-category`;

  constructor(private readonly http: HttpClient) {}

  listCategories(includeInactive = false): Observable<LivestockCategory[]> {
    const params = includeInactive ? { includeInactive: 'true' } : undefined;
    return this.http.get<ApiItem<LivestockCategory[]>>(`${this.baseUrl}/categories`, { params }).pipe(map((response) => response.data ?? []));
  }

  createCategory(body: { name: string; description: string | null; category_type: string }): Observable<LivestockCategory> {
    return this.http.post<ApiItem<LivestockCategory>>(`${this.baseUrl}/categories`, body).pipe(map((response) => response.data));
  }

  deactivateCategory(categoryUuid: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/categories/${categoryUuid}/deactivate`, {});
  }

  listAnimalCategories(animalUuid: string): Observable<AnimalCategoryAssignment[]> {
    return this.http
      .get<ApiItem<AnimalCategoryAssignment[]>>(`${this.baseUrl}/animals/${animalUuid}`)
      .pipe(map((response) => response.data ?? []));
  }

  listHistory(animalUuid: string): Observable<AnimalCategoryHistoryEntry[]> {
    return this.http
      .get<ApiItem<AnimalCategoryHistoryEntry[]>>(`${this.baseUrl}/animals/${animalUuid}/history`)
      .pipe(map((response) => response.data ?? []));
  }

  assign(animalUuid: string, categoryUuid: string, reason: string | null): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/animals/${animalUuid}`, { category_uuid: categoryUuid, reason });
  }

  remove(animalUuid: string, categoryUuid: string, reason: string | null): Observable<unknown> {
    return this.http.request('DELETE', `${this.baseUrl}/animals/${animalUuid}/${categoryUuid}`, { body: { reason } });
  }
}
