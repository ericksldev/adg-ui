import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { LoginRequest, LoginResponse, SessionData } from '../../shared/models/auth.model';
import { normalizeUserRoles, UserRole } from '../../shared/constants/domain.constants';
import { SessionService } from './session.service';
import { decodeJwtPayload } from '../utils/decode-jwt-payload';

@Injectable({
  providedIn: 'root'
})
export class AuthenticationServiceService {
  private readonly baseUrl: string = `${environment.urlApi}/session`;

  constructor(
    private readonly http: HttpClient,
    private readonly sessionService: SessionService
  ) { }

  logout(): Observable<unknown> {
    return this.http.post<unknown>(`${this.baseUrl}/logout`, {});
  }

  login(userData: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, userData).pipe(
      tap((response) => {
        if (response.success && response.data) {
          const payload = this.decodeToken(response.data.token);
          const session: SessionData = {
            token: response.data.token,
            username: response.data.user.username,
            uuid_company: response.data.user.uuid_company,
            roles: normalizeUserRoles(payload?.roles ?? []),
            membership_status: payload?.membership_status,
            membership_renewal_at: payload?.membership_renewal_at ?? null
          };
          this.sessionService.setSession(session);
        }
      })
    );
  }

  requestNewPassword(userData: unknown): Observable<unknown> {
    return this.http.post<unknown>(`${this.baseUrl}/new-password`, userData);
  }

  resetPassword(userData: unknown): Observable<unknown> {
    return this.http.post<unknown>(`${this.baseUrl}/reset-password`, userData);
  }

  getMe(): Observable<unknown> {
    return this.http.get<unknown>(`${this.baseUrl}/me`);
  }

  isAuthenticated(): boolean {
    return this.sessionService.isAuthenticated();
  }

  getUsername(): string | null {
    return this.sessionService.getUsername();
  }

  getRoles(): UserRole[] {
    return this.sessionService.getRoles();
  }

  clearSession(): void {
    this.sessionService.clearSession();
  }

  private decodeToken(
    token: string
  ): { roles?: UserRole[]; membership_status?: SessionData['membership_status']; membership_renewal_at?: string | null } | null {
    return decodeJwtPayload(token);
  }
}
