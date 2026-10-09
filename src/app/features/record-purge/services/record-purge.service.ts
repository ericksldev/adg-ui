import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ListQueryParams, PaginatedListResult } from 'src/app/shared/models/paginated-list.model';
import { mapPaginatedResponse, toHttpParams } from 'src/app/shared/utils/list-query.util';
import {
  AnimalPurgeCandidate,
  RecordDeletionAuditItem,
  WorkSessionPurgeCandidate
} from '../models/record-purge.model';

@Injectable({
  providedIn: 'root'
})
export class RecordPurgeService {
  private readonly baseUrl = `${environment.urlApi}/record-purge`;

  constructor(private readonly http: HttpClient) {}

  listAnimals(query: ListQueryParams): Observable<PaginatedListResult<AnimalPurgeCandidate>> {
    return this.http
      .get<PaginatedListResult<AnimalPurgeCandidate> & { data: AnimalPurgeCandidate[] }>(
        `${this.baseUrl}/animals`,
        { params: toHttpParams(query) }
      )
      .pipe(map((response) => mapPaginatedResponse(response)));
  }

  listWorkSessions(query: ListQueryParams): Observable<PaginatedListResult<WorkSessionPurgeCandidate>> {
    return this.http
      .get<PaginatedListResult<WorkSessionPurgeCandidate> & { data: WorkSessionPurgeCandidate[] }>(
        `${this.baseUrl}/work-sessions`,
        { params: toHttpParams(query) }
      )
      .pipe(map((response) => mapPaginatedResponse(response)));
  }

  listAudits(query: ListQueryParams): Observable<PaginatedListResult<RecordDeletionAuditItem>> {
    return this.http
      .get<PaginatedListResult<RecordDeletionAuditItem> & { data: RecordDeletionAuditItem[] }>(
        `${this.baseUrl}/audits`,
        { params: toHttpParams(query) }
      )
      .pipe(map((response) => mapPaginatedResponse(response)));
  }

  purgeAnimal(animalUuid: string): Observable<void> {
    return this.http.delete(`${this.baseUrl}/animals/${animalUuid}`).pipe(map(() => undefined));
  }

  purgeWorkSession(sessionUuid: string): Observable<void> {
    return this.http.delete(`${this.baseUrl}/work-sessions/${sessionUuid}`).pipe(map(() => undefined));
  }
}
