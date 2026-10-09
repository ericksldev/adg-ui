import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthenticationServiceService } from '../services/authentication-service.service';
import { TermsAcceptanceApiService } from '../services/terms-acceptance-api.service';

@Injectable({
  providedIn: 'root'
})
export class TermsAcceptanceGuard implements CanActivate {
  constructor(
    private readonly authenticationService: AuthenticationServiceService,
    private readonly termsAcceptanceApi: TermsAcceptanceApiService,
    private readonly router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> | boolean | UrlTree {
    if (!this.authenticationService.isAuthenticated()) {
      return true;
    }

    return this.termsAcceptanceApi.getStatus().pipe(
      map((decision) => decision.access_granted ? true : this.router.parseUrl('/terms-acceptance')),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          return of(this.router.parseUrl('/login'));
        }
        return of(this.router.parseUrl('/terms-acceptance'));
      })
    );
  }
}
