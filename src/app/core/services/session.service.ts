import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { JwtPayload, SessionData } from '../../shared/models/auth.model';
import { normalizeUserRoles, UserRole } from '../../shared/constants/domain.constants';
import { decodeJwtPayload } from '../utils/decode-jwt-payload';

const SESSION_KEY = 'adg_session';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private readonly sessionSubject = new BehaviorSubject<SessionData | null>(this.readSession());
  readonly session$ = this.sessionSubject.asObservable();

  getSession(): SessionData | null {
    return this.sessionSubject.value;
  }

  getToken(): string | null {
    return this.sessionSubject.value?.token ?? null;
  }

  getUsername(): string | null {
    return this.sessionSubject.value?.username ?? null;
  }

  getRoles(): UserRole[] {
    return this.sessionSubject.value?.roles ?? [];
  }

  getUuidCompany(): string | null {
    return this.sessionSubject.value?.uuid_company ?? null;
  }

  getUuidUser(): string | null {
    return this.decodeTokenPayload()?.sub ?? null;
  }

  isAuthenticated(): boolean {
    const payload = this.decodeTokenPayload();
    if (!payload?.exp) {
      return false;
    }

    return payload.exp * 1000 > Date.now();
  }

  setSession(data: SessionData): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    localStorage.setItem('user_name', data.username);
    localStorage.setItem('user_token', data.token);
    localStorage.setItem('user_role', data.roles.join(','));
    this.sessionSubject.next(data);
  }

  clearSession(): void {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_token');
    localStorage.removeItem('user_role');
    this.sessionSubject.next(null);
  }

  decodeTokenPayload(): JwtPayload | null {
    const token = this.getToken();
    if (!token) {
      return null;
    }

    return decodeJwtPayload<JwtPayload>(token);
  }

  private readSession(): SessionData | null {
    const rawSession = localStorage.getItem(SESSION_KEY);
    if (!rawSession) {
      return null;
    }

    try {
      const session = JSON.parse(rawSession) as SessionData;
      if (session?.token && (!session.roles || session.roles.length === 0)) {
        const payload = decodeJwtPayload<JwtPayload & { roles?: string[] }>(session.token);
        if (payload?.roles?.length) {
          session.roles = normalizeUserRoles(payload.roles);
          localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        }
      }
      return session;
    } catch {
      return null;
    }
  }
}
