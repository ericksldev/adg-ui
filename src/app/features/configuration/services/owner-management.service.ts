import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ListQueryParams, PaginatedListResponse, PaginatedListResult } from 'src/app/shared/models/paginated-list.model';
import { mapPaginatedResponse, toHttpParams } from 'src/app/shared/utils/list-query.util';
import { Owner, OwnerListItem, OwnerPayload } from '../models/owner.model';

interface ApiItemResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class OwnerManagementService {
  private readonly ownerUrl = `${environment.urlApi}/owner`;

  constructor(private readonly http: HttpClient) {}

  getOwners(query: ListQueryParams): Observable<PaginatedListResult<OwnerListItem>> {
    return this.http
      .get<PaginatedListResponse<OwnerListItem>>(this.ownerUrl, {
        params: toHttpParams({ sortBy: 'full_name', order: 'ASC', status: 'active', ...query }),
      })
      .pipe(map((response) => mapPaginatedResponse(response)));
  }

  getOwnerById(ownerUuid: string): Observable<Owner> {
    return this.http
      .get<ApiItemResponse<Owner>>(`${this.ownerUrl}/${ownerUuid}`)
      .pipe(map((r) => r.data));
  }

  createOwner(payload: OwnerPayload): Observable<Owner> {
    return this.http
      .post<ApiItemResponse<Owner>>(this.ownerUrl, payload)
      .pipe(map((r) => r.data));
  }

  updateOwner(ownerUuid: string, payload: Partial<OwnerPayload>): Observable<Owner> {
    return this.http
      .put<ApiItemResponse<Owner>>(`${this.ownerUrl}/${ownerUuid}`, payload)
      .pipe(map((r) => r.data));
  }

  deleteOwner(ownerUuid: string): Observable<void> {
    return this.http.delete<ApiItemResponse<null>>(`${this.ownerUrl}/${ownerUuid}`).pipe(map(() => undefined));
  }
}
