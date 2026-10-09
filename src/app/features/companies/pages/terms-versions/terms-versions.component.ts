import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { I18nService } from 'src/app/core/services/i18n.service';
import { TermsAcceptanceApiService } from 'src/app/core/services/terms-acceptance-api.service';
import { SessionService } from 'src/app/core/services/session.service';
import { hasPermission, Permission } from 'src/app/shared/constants/permissions';
import { TermsDocument } from 'src/app/features/auth/models/terms.model';

interface TermsVersionForm {
  version: string;
  title: string;
  content: string;
  effectiveAt: string;
  requiresAcceptance: boolean;
  publish: boolean;
}

@Component({
  selector: 'app-terms-versions',
  templateUrl: './terms-versions.component.html',
  styleUrls: ['./terms-versions.component.scss']
})
export class TermsVersionsComponent implements OnInit {
  versions: TermsDocument[] = [];
  errorMessage = '';
  isLoading = false;
  isSaving = false;
  showForm = false;
  form: TermsVersionForm = this.emptyForm();

  constructor(
    private readonly termsApi: TermsAcceptanceApiService,
    private readonly i18n: I18nService,
    private readonly sessionService: SessionService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get canWrite(): boolean {
    return hasPermission(this.sessionService.getRoles(), Permission.TERMS_VERSION_WRITE);
  }

  load(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.termsApi.listVersions().subscribe({
      next: (versions) => {
        this.versions = versions;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = this.i18n.translate('termsAdmin.errorLoad');
        this.isLoading = false;
      }
    });
  }

  startCreate(): void {
    this.form = this.emptyForm();
    this.showForm = true;
    this.errorMessage = '';
  }

  cancel(): void {
    this.showForm = false;
  }

  save(): void {
    if (!this.canWrite || this.isSaving) {
      return;
    }
    if (!this.form.version.trim() || !this.form.title.trim() || !this.form.content.trim() || !this.form.effectiveAt) {
      this.errorMessage = this.i18n.translate('termsAdmin.requiredFields');
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.termsApi.createVersion({
      version: this.form.version.trim(),
      title: this.form.title.trim(),
      content: this.form.content,
      effective_at: new Date(`${this.form.effectiveAt}T12:00:00.000Z`).toISOString(),
      requires_acceptance: this.form.requiresAcceptance,
      publish: this.form.publish
    }).subscribe({
      next: () => {
        this.isSaving = false;
        this.showForm = false;
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving = false;
        const message = (error.error as { error?: { message?: string } } | undefined)?.error?.message;
        this.errorMessage = message || this.i18n.translate('termsAdmin.errorSave');
      }
    });
  }

  publish(version: TermsDocument): void {
    if (!this.canWrite || version.is_active || this.isSaving) {
      return;
    }
    this.isSaving = true;
    this.errorMessage = '';
    this.termsApi.publishVersion(version.uuid_terms_version).subscribe({
      next: () => {
        this.isSaving = false;
        this.load();
      },
      error: () => {
        this.isSaving = false;
        this.errorMessage = this.i18n.translate('termsAdmin.errorSave');
      }
    });
  }

  private emptyForm(): TermsVersionForm {
    const today = new Date().toISOString().slice(0, 10);
    return {
      version: '',
      title: 'Condiciones de Servicio y Aceptación de Membresía',
      content: '',
      effectiveAt: today,
      requiresAcceptance: true,
      publish: true
    };
  }
}
