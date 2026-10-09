import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ApiItemResponse, ApiListResponse } from '../models/company-management.model';
import { SaasPlan, SaasPlanWritePayload } from '../models/saas-plan.model';

@Injectable({
  providedIn: 'root'
})
export class SaasPlanApiService {
  private readonly url = `${environment.urlApi}/saas-plan`;

  constructor(private readonly http: HttpClient) {}

  list(status: 'all' | 'active' | 'inactive' = 'all'): Observable<SaasPlan[]> {
    const params = new HttpParams()
      .set('status', status)
      .set('page', '1')
      .set('size', '100')
      .set('sortBy', 'name')
      .set('order', 'ASC');
    return this.http.get<ApiListResponse<SaasPlan>>(this.url, { params }).pipe(
      map((response) => response.data ?? [])
    );
  }

  create(payload: SaasPlanWritePayload): Observable<SaasPlan> {
    return this.http.post<ApiItemResponse<SaasPlan>>(this.url, payload).pipe(
      map((response) => response.data)
    );
  }

  update(uuidPlan: string, payload: SaasPlanWritePayload): Observable<SaasPlan> {
    return this.http.put<ApiItemResponse<SaasPlan>>(`${this.url}/${uuidPlan}`, payload).pipe(
      map((response) => response.data)
    );
  }
}
