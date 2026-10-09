import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationServiceService } from 'src/app/core/services/authentication-service.service';
import { TermsAcceptanceApiService } from 'src/app/core/services/terms-acceptance-api.service';
import { TermsBlockReason, TermsDocument } from '../../models/terms.model';
import { renderTermsDocument } from '../../utils/render-terms-document';

@Component({
  selector: 'app-terms-acceptance',
  templateUrl: './terms-acceptance.component.html',
  styleUrls: ['./terms-acceptance.component.scss']
})
export class TermsAcceptanceComponent implements OnInit {
  isLoading = true;
  isSubmitting = false;
  hasAccepted = false;
  document: TermsDocument | null = null;
  documentHtml = '';
  blockReason: TermsBlockReason | null = null;
  loadErrorKey = '';
  actionErrorKey = '';

  constructor(
    private readonly termsApi: TermsAcceptanceApiService,
    private readonly authenticationService: AuthenticationServiceService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get canSubmit(): boolean {
    return Boolean(this.document)
      && this.hasAccepted
      && !this.isSubmitting
      && this.blockReason === 'acceptance_required';
  }

  load(): void {
    this.isLoading = true;
    this.loadErrorKey = '';
    this.actionErrorKey = '';
    this.document = null;
    this.documentHtml = '';
    this.hasAccepted = false;

    this.termsApi.getStatus().subscribe({
      next: (decision) => {
        this.blockReason = decision.block_reason;
        if (decision.access_granted) {
          this.router.navigateByUrl('/home');
          return;
        }
        if (decision.block_reason !== 'acceptance_required' || !decision.current_version) {
          this.isLoading = false;
          return;
        }
        this.loadDocument();
      },
      error: (error: HttpErrorResponse) => {
        this.loadErrorKey = this.messageKey(error);
        this.isLoading = false;
      }
    });
  }

  accept(): void {
    if (!this.canSubmit || !this.document) {
      return;
    }

    this.isSubmitting = true;
    this.actionErrorKey = '';
    this.termsApi.accept(this.document.uuid_terms_version).subscribe({
      next: (result) => {
        this.isSubmitting = false;
        if (!result.access.access_granted) {
          this.actionErrorKey = 'terms.stillBlocked';
          this.blockReason = result.access.block_reason;
          return;
        }
        this.router.navigateByUrl('/home');
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting = false;
        this.actionErrorKey = this.messageKey(error, 'terms.acceptError');
      }
    });
  }

  logout(): void {
    this.authenticationService.logout().subscribe({
      next: () => this.leave(),
      error: () => this.leave()
    });
  }

  private loadDocument(): void {
    this.termsApi.getCurrent().subscribe({
      next: (document) => {
        this.document = document;
        this.documentHtml = renderTermsDocument(document.content ?? '');
        this.blockReason = 'acceptance_required';
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.loadErrorKey = this.messageKey(error);
        this.isLoading = false;
      }
    });
  }

  private leave(): void {
    this.authenticationService.clearSession();
    this.router.navigateByUrl('/login');
  }

  private messageKey(error: HttpErrorResponse, fallback = 'terms.loadError'): string {
    if (error.status === 0) {
      return 'terms.connectionError';
    }
    if (error.status === 401) {
      return 'terms.sessionExpired';
    }

    const name = (error.error as { error?: { name?: string } } | undefined)?.error?.name;
    switch (name) {
      case 'OrganizationMembershipRequired':
        return 'terms.membershipInvalid';
      case 'MembershipExpired':
        return 'terms.membershipExpired';
      case 'CompanyInactive':
        return 'terms.companyInactive';
      case 'TermsAcceptanceCheckFailed':
        return 'terms.unavailable';
      case 'ConflictError':
        return 'terms.versionChanged';
      default:
        return fallback;
    }
  }
}
