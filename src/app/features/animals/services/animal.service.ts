import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ListQueryParams, PaginatedListResponse, PaginatedListResult } from 'src/app/shared/models/paginated-list.model';
import { mapPaginatedResponse, toHttpParams } from 'src/app/shared/utils/list-query.util';
import { AnimalDetail } from '../models/animal-detail.model';
import { AnimalDeactivateBatchPayload } from '../models/animal-deactivate-draft.model';
import {
  AnimalDeactivateBatchResult,
  AnimalDeactivatePayload
} from '../models/animal-exit.model';
import { AnimalListItem } from '../models/animal.model';
import { AnimalCreatePayload } from '../models/animal-create-payload.model';

interface ApiItemResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class AnimalService {
  private readonly baseUrl: string = `${environment.urlApi}/animal`;

  constructor(private readonly http: HttpClient) {}

  getAnimals(query: ListQueryParams): Observable<PaginatedListResult<AnimalListItem>> {
    return this.http
      .get<PaginatedListResponse<AnimalListItem>>(this.baseUrl, { params: toHttpParams(query) })
      .pipe(map((response) => mapPaginatedResponse(response)));
  }

  getAnimalById(animalUuid: string, includeInactive = false): Observable<AnimalDetail> {
    const params = includeInactive ? { includeInactive: 'true' } : undefined;
    return this.http
      .get<ApiItemResponse<AnimalDetail>>(`${this.baseUrl}/${animalUuid}`, { params })
      .pipe(map((response) => response.data));
  }

  updateAnimal(animalUuid: string, payload: Partial<AnimalCreatePayload> & {
    current_status?: string;
    mother_registration_number?: string | null;
    father_registration_number?: string | null;
  }): Observable<AnimalDetail> {
    return this.http
      .put<ApiItemResponse<AnimalDetail>>(`${this.baseUrl}/${animalUuid}`, payload)
      .pipe(map((response) => response.data));
  }

  deactivateAnimal(animalUuid: string, payload: AnimalDeactivatePayload): Observable<void> {
    return this.http
      .post<ApiItemResponse<unknown>>(`${this.baseUrl}/${animalUuid}/deactivate`, payload)
      .pipe(map(() => undefined));
  }

  deactivateAnimalsBatch(payload: AnimalDeactivateBatchPayload): Observable<AnimalDeactivateBatchResult> {
    return this.http
      .post<ApiItemResponse<AnimalDeactivateBatchResult>>(`${this.baseUrl}/deactivate/batch`, payload)
      .pipe(map((response) => response.data));
  }
}
