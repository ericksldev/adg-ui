import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface CompanyFieldAvailabilityResult {
  nameAvailable: boolean;
  taxIdAvailable: boolean;
}

interface ApiItemResponse<T> {
  success: boolean;
  data?: T;
}

@Injectable({
  providedIn: 'root'
})
export class CompanyFieldAvailabilityService {
  private readonly companyUrl = `${environment.urlApi}/company`;

  constructor(private readonly http: HttpClient) {}

  check(params: {
    exclude_uuid_company?: string;
    name?: string;
    tax_id?: string;
  }): Observable<CompanyFieldAvailabilityResult> {
    let httpParams = new HttpParams();
    if (params.exclude_uuid_company) {
      httpParams = httpParams.set('exclude_uuid_company', params.exclude_uuid_company);
    }
    if (params.name?.trim()) {
      httpParams = httpParams.set('name', params.name.trim());
    }
    if (params.tax_id?.trim()) {
      httpParams = httpParams.set('tax_id', params.tax_id.trim());
    }

    return this.http
      .get<ApiItemResponse<CompanyFieldAvailabilityResult>>(`${this.companyUrl}/availability`, {
        params: httpParams
      })
      .pipe(
        map((response) => response.data ?? { nameAvailable: true, taxIdAvailable: true })
      );
  }
}
