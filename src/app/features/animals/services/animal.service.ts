import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ListQueryParams, PaginatedListResponse, PaginatedListResult, ApiPagination } from 'src/app/shared/models/paginated-list.model';
import { mapPaginatedResponse, toHttpParams } from 'src/app/shared/utils/list-query.util';
import { AnimalDetail } from '../models/animal-detail.model';
import { AnimalDeactivateBatchPayload } from '../models/animal-deactivate-draft.model';
import {
  AnimalDeactivateBatchResult,
  AnimalDeactivatePayload
} from '../models/animal-exit.model';
import { AnimalListItem } from '../models/animal.model';
import { AnimalCreatePayload } from '../models/animal-create-payload.model';
import {
  AnimalAttendanceQuery,
  AnimalAttendanceReview
} from '../models/animal-attendance.model';

interface ApiItemResponse<T> {
  success: boolean;
  data: T;
  pagination?: ApiPagination;
}

export interface AnimalAttendanceResult {
  review: AnimalAttendanceReview;
  pagination: ApiPagination;
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

  reviewAttendance(query: AnimalAttendanceQuery): Observable<AnimalAttendanceResult> {
    let params = new HttpParams().set('ranch_uuid', query.ranch_uuid);
    if (query.from) {
      params = params.set('from', query.from);
    }
    if (query.to) {
      params = params.set('to', query.to);
    }
    if (query.paddock_uuid) {
      params = params.set('paddock_uuid', query.paddock_uuid);
    }
    if (query.animal_uuid) {
      params = params.set('animal_uuid', query.animal_uuid);
    }
    if (query.attendance_status) {
      params = params.set('attendance_status', query.attendance_status);
    }
    if (query.page != null) {
      params = params.set('page', String(query.page));
    }
    if (query.size != null) {
      params = params.set('size', String(query.size));
    }

    return this.http
      .get<ApiItemResponse<AnimalAttendanceReview>>(`${environment.urlApi}/animal-attendance`, { params })
      .pipe(
        map((response) => ({
          review: response.data,
          pagination: response.pagination ?? {
            totalItems: response.data?.animals?.length ?? 0,
            totalPages: 1,
            currentPage: query.page ?? 1,
            order: 'ASC',
            pageSize: query.size ?? response.data?.animals?.length ?? 0
          }
        }))
      );
  }

  deactivateAnimalsBatch(payload: AnimalDeactivateBatchPayload): Observable<AnimalDeactivateBatchResult> {
    return this.http
      .post<ApiItemResponse<AnimalDeactivateBatchResult>>(`${this.baseUrl}/deactivate/batch`, payload)
      .pipe(map((response) => response.data));
  }
}
