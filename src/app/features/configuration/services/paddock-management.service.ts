import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Paddock, PaddockListItem, PaddockPayload } from '../models/paddock.model';

interface ApiItemResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class PaddockManagementService {
  private readonly paddockUrl = `${environment.urlApi}/paddock`;
  private readonly ranchUrl = `${environment.urlApi}/ranch`;

  constructor(private readonly http: HttpClient) {}

  getPaddocksForRanch(ranchUuid: string): Observable<PaddockListItem[]> {
    const params = new HttpParams().set('ranch_uuid', ranchUuid);
    return this.http
      .get<ApiItemResponse<PaddockListItem[]>>(this.paddockUrl, { params })
      .pipe(map((r) => r.data ?? []));
  }

  /** Kept for animal registration flows that still use the nested ranch route. */
  getPaddocksForRanchLegacy(ranchUuid: string): Observable<PaddockListItem[]> {
    return this.http
      .get<ApiItemResponse<PaddockListItem[]>>(`${this.ranchUrl}/${ranchUuid}/paddocks`)
      .pipe(map((r) => r.data ?? []));
  }

  getPaddockById(paddockUuid: string): Observable<Paddock> {
    return this.http
      .get<ApiItemResponse<Paddock>>(`${this.paddockUrl}/${paddockUuid}`)
      .pipe(map((r) => r.data));
  }

  createPaddock(payload: PaddockPayload): Observable<Paddock> {
    return this.http
      .post<ApiItemResponse<Paddock>>(this.paddockUrl, payload)
      .pipe(map((r) => r.data));
  }

  updatePaddock(paddockUuid: string, payload: Partial<PaddockPayload>): Observable<Paddock> {
    return this.http
      .put<ApiItemResponse<Paddock>>(`${this.paddockUrl}/${paddockUuid}`, payload)
      .pipe(map((r) => r.data));
  }

  deletePaddock(paddockUuid: string): Observable<void> {
    return this.http.delete<ApiItemResponse<null>>(`${this.paddockUrl}/${paddockUuid}`).pipe(map(() => undefined));
  }
}
