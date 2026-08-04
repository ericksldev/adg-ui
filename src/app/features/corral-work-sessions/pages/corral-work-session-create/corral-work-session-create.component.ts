import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { translateApiError } from 'src/app/core/utils/api-error.util';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { normalizeUserRoles } from 'src/app/shared/constants/domain.constants';
import { CompanyOption, RanchOption } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import { isCorralActivityCode } from '../../constants/corral-activities';
import { CorralWorkSessionApiService } from '../../services/corral-work-session-api.service';

@Component({
  selector: 'app-corral-work-session-create',
  templateUrl: './corral-work-session-create.component.html'
})
export class CorralWorkSessionCreateComponent implements OnInit {
  loading = false;
  saving = false;
  errorMessage = '';
  ranchRows: RanchOption[] = [];
  companyRows: CompanyOption[] = [];
  selectedCompany = '';

  ranchUuid = '';
  workDate = new Date().toISOString().slice(0, 10);
  responsiblePerson = '';
  notes = '';

  constructor(
    private readonly api: CorralWorkSessionApiService,
    private readonly userManagementService: UserManagementService,
    private readonly sessionService: SessionService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    readonly i18n: I18nService
  ) {}

  get isSaasOwner(): boolean {
    return normalizeUserRoles(this.sessionService.getRoles() as string[]).includes('saas_owner');
  }

  ngOnInit(): void {
    if (this.isSaasOwner) {
      this.loadCompanies();
      return;
    }
    this.loadRanches();
  }

  onCompanyChange(uuid: string): void {
    this.selectedCompany = uuid;
    this.ranchUuid = '';
    this.loadRanches();
  }

  private loadCompanies(): void {
    this.loading = true;
    this.errorMessage = '';
    this.userManagementService
      .getCompanies()
      .pipe(
        catchError(() => {
          this.errorMessage = this.i18n.translate('errors.loadCompanies');
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((companies) => {
        this.companyRows = companies;
        if (companies.length === 1) {
          this.selectedCompany = companies[0].uuid_company;
          this.loadRanches();
        }
      });
  }

  private loadRanches(): void {
    const company = this.isSaasOwner
      ? this.selectedCompany.trim() || undefined
      : this.sessionService.getUuidCompany() ?? undefined;

    if (this.isSaasOwner && !company) {
      this.ranchRows = [];
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.userManagementService
      .getRanches(company)
      .pipe(
        catchError((err) => {
          this.errorMessage =
            translateApiError(this.i18n, err, 'errors.loadRanches');
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((ranches) => {
        this.ranchRows = ranches;
        if (ranches.length === 1) {
          this.ranchUuid = ranches[0].uuid_ranch;
        }
      });
  }

  submit(): void {
    this.errorMessage = '';

    if (!this.ranchUuid || !this.workDate) {
      this.errorMessage = this.i18n.translate('corralWorkSession.errorRequiredFields');
      return;
    }

    this.saving = true;
    this.api
      .createSession({
        ranch_uuid: this.ranchUuid,
        work_date: this.workDate,
        responsible_person: this.responsiblePerson.trim() || null,
        notes: this.notes.trim() || null
      })
      .pipe(
        catchError((err) => {
          this.errorMessage =
            translateApiError(this.i18n, err, 'corralWorkSession.errorCreate');
          return of(null);
        }),
        finalize(() => {
          this.saving = false;
        })
      )
      .subscribe((session) => {
        if (!session) return;
        const activity = this.route.snapshot.queryParamMap.get('activity');
        if (isCorralActivityCode(activity)) {
          void this.router.navigate(['/corral-work-session', session.uuid_corral_work_session, 'setup'], {
            queryParams: { activity }
          });
          return;
        }
        void this.router.navigate(['/corral-work-session']);
      });
  }

  cancel(): void {
    const activity = this.route.snapshot.queryParamMap.get('activity');
    if (isCorralActivityCode(activity)) {
      void this.router.navigate(['/corral-work-session', 'activity', activity]);
      return;
    }
    void this.router.navigate(['/corral-work-session']);
  }
}
