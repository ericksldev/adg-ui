import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ListQueryParams, PaginatedListResult } from 'src/app/shared/models/paginated-list.model';
import { mapPaginatedResponse, toHttpParams } from 'src/app/shared/utils/list-query.util';
import {
  ApiItemResponse,
  ApiListResponse,
  CompanyOption,
  MembershipItem,
  RanchOption,
  UserManagementItem,
  UserManagementPayload
} from '../models/user-management.model';

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  private readonly userUrl = `${environment.urlApi}/user`;
  private readonly companyUrl = `${environment.urlApi}/company`;
  private readonly ranchUrl = `${environment.urlApi}/ranch`;
  private readonly membershipUrl = `${environment.urlApi}/membership`;

  constructor(private readonly http: HttpClient) {}

  getUsers(query: ListQueryParams): Observable<PaginatedListResult<UserManagementItem>> {
    const params = toHttpParams({
      status: 'all',
      sortBy: 'username',
      order: 'ASC',
      ...query,
    });
    return this.http
      .get<ApiListResponse<UserManagementItem>>(this.userUrl, { params })
      .pipe(map((response) => mapPaginatedResponse(response)));
  }

  getUserById(uuidUser: string): Observable<UserManagementItem> {
    return this.http
      .get<ApiItemResponse<UserManagementItem>>(`${this.userUrl}/${uuidUser}`)
      .pipe(map((response) => response.data));
  }

  createUser(payload: UserManagementPayload): Observable<UserManagementItem> {
    return this.http
      .post<ApiItemResponse<UserManagementItem>>(this.userUrl, payload)
      .pipe(map((response) => response.data));
  }

  updateUser(uuidUser: string, payload: UserManagementPayload): Observable<UserManagementItem> {
    return this.http
      .put<ApiItemResponse<UserManagementItem>>(`${this.userUrl}/${uuidUser}`, payload)
      .pipe(map((response) => response.data));
  }

  deactivateUser(uuidUser: string): Observable<unknown> {
    return this.http.delete(`${this.userUrl}/${uuidUser}`);
  }

  getCompanies(): Observable<CompanyOption[]> {
    return this.http
      .get<ApiListResponse<CompanyOption>>(this.companyUrl)
      .pipe(map((response) => response.data ?? []));
  }

  getRanches(uuidCompany?: string): Observable<RanchOption[]> {
    let params = new HttpParams().set('page', '1').set('size', '500');
    if (uuidCompany?.trim()) {
      params = params.set('uuid_company', uuidCompany);
    }
    return this.http
      .get<ApiListResponse<RanchOption>>(this.ranchUrl, { params })
      .pipe(map((response) => response.data ?? []));
  }

  getMembershipsByRanch(uuidRanch: string): Observable<MembershipItem[]> {
    const params = new HttpParams().set('page', '1').set('size', '500');
    return this.http
      .get<ApiListResponse<MembershipItem>>(`${this.membershipUrl}/ranch/${uuidRanch}`, { params })
      .pipe(map((response) => response.data ?? []));
  }

  getMembershipsByUser(uuidUser: string): Observable<MembershipItem[]> {
    const params = new HttpParams().set('page', '1').set('size', '500');
    return this.http
      .get<ApiListResponse<MembershipItem>>(`${this.membershipUrl}/user/${uuidUser}`, { params })
      .pipe(map((response) => response.data ?? []));
  }

  promoteCompanyAdministrator(uuidUser: string): Observable<unknown> {
    return this.http.post(`${this.membershipUrl}/company-administrator`, { uuid_user: uuidUser });
  }

  assignMembership(uuidUser: string, _uuidRanch: string | undefined, role: string): Observable<unknown> {
    return this.http.post(this.membershipUrl, {
      uuid_user: uuidUser,
      role
    });
  }

  updateMembershipRole(uuidUser: string, _uuidRanch: string | undefined, role: string): Observable<unknown> {
    return this.http.put(`${this.membershipUrl}/${uuidUser}`, { role });
  }
}
