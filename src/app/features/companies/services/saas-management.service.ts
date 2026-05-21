import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  ApiItemResponse,
  ApiListResponse,
  CompanyManagement,
  CompanyPayment,
  CompanyPaidActivationPayload,
  CompanyTrialActivationPayload,
  CompanyUser,
  RanchSummary
} from '../models/company-management.model';

@Injectable({
  providedIn: 'root'
})
export class SaasManagementService {
  private readonly companyUrl = `${environment.urlApi}/company`;
  private readonly userUrl = `${environment.urlApi}/user`;
  private readonly ranchUrl = `${environment.urlApi}/ranch`;

  constructor(private readonly http: HttpClient) {}

  getCompanies(): Observable<CompanyManagement[]> {
    const params = new HttpParams().set('status', 'all').set('page', '1').set('size', '500');
    return this.http
      .get<ApiListResponse<CompanyManagement>>(this.companyUrl, { params })
      .pipe(map((response) => response.data ?? []));
  }

  getCompany(uuidCompany: string): Observable<CompanyManagement> {
    const params = new HttpParams().set('includeInactive', 'true');
    return this.http
      .get<ApiItemResponse<CompanyManagement>>(`${this.companyUrl}/${uuidCompany}`, { params })
      .pipe(map((response) => response.data as CompanyManagement));
  }

  createCompany(payload: Partial<CompanyManagement>): Observable<CompanyManagement> {
    return this.http.post<ApiItemResponse<CompanyManagement>>(this.companyUrl, payload).pipe(
      map((response) => response.data)
    );
  }

  updateCompany(uuidCompany: string, payload: Partial<CompanyManagement>): Observable<CompanyManagement> {
    return this.http.put<ApiItemResponse<CompanyManagement>>(`${this.companyUrl}/${uuidCompany}`, payload).pipe(
      map((response) => response.data)
    );
  }

  deactivateCompany(uuidCompany: string): Observable<unknown> {
    return this.http.delete(`${this.companyUrl}/${uuidCompany}`);
  }

  reactivateCompany(uuidCompany: string): Observable<CompanyManagement> {
    return this.http
      .post<ApiItemResponse<CompanyManagement>>(`${this.companyUrl}/${uuidCompany}/reactivate`, {})
      .pipe(map((response) => response.data as CompanyManagement));
  }

  endCompanySubscription(uuidCompany: string): Observable<CompanyManagement> {
    return this.http
      .post<ApiItemResponse<CompanyManagement>>(`${this.companyUrl}/${uuidCompany}/end-subscription`, {})
      .pipe(map((response) => response.data as CompanyManagement));
  }

  getCompanyUsers(uuidCompany: string): Observable<CompanyUser[]> {
    return this.http.get<ApiListResponse<CompanyUser>>(`${this.userUrl}?uuid_company=${uuidCompany}`).pipe(
      map((response) => response.data ?? [])
    );
  }

  createCompanyUser(
    payload: Partial<CompanyUser> & {
      id_card?: string;
      first_name?: string;
      last_name?: string;
      email: string;
      username: string;
      password: string;
      uuid_company: string;
      role?: string;
    }
  ): Observable<CompanyUser> {
    return this.http.post<ApiItemResponse<CompanyUser>>(this.userUrl, payload).pipe(
      map((response) => response.data)
    );
  }

  deactivateCompanyUser(uuidUser: string): Observable<unknown> {
    return this.http.delete(`${this.userUrl}/${uuidUser}`);
  }

  getCompanyPayments(uuidCompany: string): Observable<CompanyPayment[]> {
    return this.http
      .get<ApiListResponse<CompanyPayment>>(`${this.companyUrl}/${uuidCompany}/payments`)
      .pipe(map((response) => response.data ?? []));
  }

  createCompanyPayment(uuidCompany: string, payload: CompanyPaidActivationPayload): Observable<CompanyPayment> {
    return this.http
      .post<ApiItemResponse<CompanyPayment>>(`${this.companyUrl}/${uuidCompany}/payments`, payload)
      .pipe(map((response) => response.data));
  }

  activateTrial(uuidCompany: string, payload: CompanyTrialActivationPayload): Observable<CompanyManagement> {
    return this.http
      .post<ApiItemResponse<CompanyManagement>>(`${this.companyUrl}/${uuidCompany}/activate-trial`, payload)
      .pipe(map((response) => response.data));
  }

  voidCompanyPayment(uuidCompany: string, uuidPayment: string): Observable<unknown> {
    return this.http.delete(`${this.companyUrl}/${uuidCompany}/payments/${uuidPayment}`);
  }

  getRanchesByCompany(uuidCompany: string): Observable<RanchSummary[]> {
    const params = new HttpParams()
      .set('page', '1')
      .set('size', '500')
      .set('status', 'all')
      .set('uuid_company', uuidCompany);
    return this.http
      .get<ApiListResponse<RanchSummary>>(this.ranchUrl, { params })
      .pipe(map((response) => response.data ?? []));
  }

  createRanch(payload: { name: string; uuid_company: string; location?: string | null; area?: string | null }): Observable<RanchSummary> {
    return this.http.post<ApiItemResponse<RanchSummary>>(this.ranchUrl, payload).pipe(map((response) => response.data));
  }

  updateRanch(
    uuidRanch: string,
    payload: Partial<{ name: string; location: string | null; area: string | null }>
  ): Observable<RanchSummary> {
    return this.http
      .put<ApiItemResponse<RanchSummary>>(`${this.ranchUrl}/${uuidRanch}`, payload)
      .pipe(map((response) => response.data));
  }

  deleteRanch(uuidRanch: string): Observable<unknown> {
    return this.http.delete(`${this.ranchUrl}/${uuidRanch}`);
  }
}
