import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
  ApiResponse,
  TermsAcceptResult,
  TermsAccessDecision,
  TermsDocument,
  TermsVersionSummary,
  TermsVersionWritePayload,
  unavailableTermsDecision
} from '../../features/auth/models/terms.model';

@Injectable({
  providedIn: 'root'
})
export class TermsAcceptanceApiService {
  private readonly baseUrl = `${environment.urlApi}/terms`;

  constructor(private readonly http: HttpClient) {}

  getStatus(): Observable<TermsAccessDecision> {
    return this.http.get<ApiResponse<TermsAccessDecision>>(`${this.baseUrl}/status`).pipe(
      map((response) => response.success && response.data ? response.data : unavailableTermsDecision())
    );
  }

  getCurrent(): Observable<TermsDocument> {
    return this.http.get<ApiResponse<TermsDocument>>(`${this.baseUrl}/current`).pipe(
      map((response) => {
        if (!response.success || !response.data) {
          throw new Error('Terms document unavailable');
        }
        return response.data;
      })
    );
  }

  accept(uuidTermsVersion: string): Observable<TermsAcceptResult> {
    return this.http.post<ApiResponse<TermsAcceptResult>>(`${this.baseUrl}/accept`, {
      uuid_terms_version: uuidTermsVersion,
      accepted: true
    }).pipe(
      map((response) => {
        if (!response.success || !response.data?.access) {
          throw new Error('Terms acceptance was not recorded');
        }
        return response.data;
      })
    );
  }

  listVersions(): Observable<TermsDocument[]> {
    return this.http.get<ApiResponse<TermsDocument[]>>(`${this.baseUrl}/versions`).pipe(
      map((response) => response.success && response.data ? response.data : [])
    );
  }

  createVersion(payload: TermsVersionWritePayload): Observable<TermsVersionSummary> {
    return this.http.post<ApiResponse<TermsVersionSummary>>(`${this.baseUrl}/versions`, payload).pipe(
      map((response) => {
        if (!response.success || !response.data) {
          throw new Error('Terms version was not created');
        }
        return response.data;
      })
    );
  }

  publishVersion(uuidTermsVersion: string): Observable<TermsVersionSummary> {
    return this.http.post<ApiResponse<TermsVersionSummary>>(
      `${this.baseUrl}/versions/${uuidTermsVersion}/publish`,
      {}
    ).pipe(
      map((response) => {
        if (!response.success || !response.data) {
          throw new Error('Terms version was not published');
        }
        return response.data;
      })
    );
  }
}
