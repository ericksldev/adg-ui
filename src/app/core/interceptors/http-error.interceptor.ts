import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SessionService } from '../services/session.service';

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
  constructor(
    private readonly sessionService: SessionService,
    private readonly router: Router
  ) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !req.url.includes('/session/login')) {
          this.sessionService.clearSession();
          this.router.navigate(['/login']);
        }

        if (error.status === 403) {
          const name = (error.error as { error?: { name?: string } } | undefined)?.error?.name;
          const blocksApplication = name === 'TermsAcceptanceRequired'
            || name === 'OrganizationMembershipRequired'
            || name === 'TermsAcceptanceCheckFailed'
            || name === 'MembershipExpired'
            || name === 'CompanyInactive';
          const isTermsRequest = req.url.includes('/terms/status')
            || req.url.includes('/terms/current')
            || req.url.includes('/terms/accept');

          if (!isTermsRequest && blocksApplication && !this.router.url.startsWith('/terms-acceptance')) {
            this.router.navigate(['/terms-acceptance']);
          } else if (!isTermsRequest && !blocksApplication) {
            this.router.navigate(['/home']);
          }
        }

        return throwError(() => error);
      })
    );
  }
}
