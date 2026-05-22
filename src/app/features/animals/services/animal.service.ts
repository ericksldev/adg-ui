import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ListQueryParams, PaginatedListResponse, PaginatedListResult } from 'src/app/shared/models/paginated-list.model';
import { mapPaginatedResponse, toHttpParams } from 'src/app/shared/utils/list-query.util';
import { AnimalListItem } from '../models/animal.model';

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
}
