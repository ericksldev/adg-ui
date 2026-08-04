import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { translateApiError } from 'src/app/core/utils/api-error.util';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { normalizeUserRoles } from 'src/app/shared/constants/domain.constants';
import { CompanyOption, RanchOption } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import {
  CORRAL_ACTIVITY_ICONS,
  CorralActivityCode,
  isCorralActivityCode
} from '../../constants/corral-activities';
import { getCorralActivityShortcutConfig } from '../../constants/corral-activity-entry.config';
import { CorralWorkSessionDto } from '../../models/corral-work-session.model';
import { CorralActivityQuickStartService } from '../../services/corral-activity-quick-start.service';
import { CorralWorkSessionApiService } from '../../services/corral-work-session-api.service';

@Component({
  selector: 'app-corral-activity-shortcut-page',
  templateUrl: './corral-activity-shortcut-page.component.html',
  styleUrls: ['./corral-activity-shortcut-page.component.scss']
})
export class CorralActivityShortcutPageComponent implements OnInit, OnDestroy {
  activityCode!: CorralActivityCode;
  activityIcon = '';

  loading = false;
  starting = false;
  startingWork = false;
  errorMessage = '';
  sessions: CorralWorkSessionDto[] = [];
  ranchRows: RanchOption[] = [];
  companyRows: CompanyOption[] = [];
  ranchNameByUuid = new Map<string, string>();

  selectedCompany = '';
  quickRanchUuid = '';
  quickWorkDate = new Date().toISOString().slice(0, 10);
  quickResponsiblePerson = '';

  filterRanchUuid = '';
  filterWorkDate = '';

  private routeSub?: Subscription;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: CorralWorkSessionApiService,
    private readonly quickStart: CorralActivityQuickStartService,
    private readonly userManagementService: UserManagementService,
    private readonly sessionService: SessionService,
    private readonly router: Router,
    readonly i18n: I18nService
  ) {}

  get isSaasOwner(): boolean {
    return normalizeUserRoles(this.sessionService.getRoles() as string[]).includes('saas_owner');
  }

  ngOnInit(): void {
    if (this.isSaasOwner) {
      this.loadCompanies();
    } else {
      this.loadRanches();
    }

    this.routeSub = this.route.paramMap.subscribe((params) => {
      const activityCode = params.get('activityCode');
      if (!isCorralActivityCode(activityCode)) {
        void this.router.navigate(['/corral-work-session']);
        return;
      }
      this.activityCode = activityCode;
      this.activityIcon = CORRAL_ACTIVITY_ICONS[activityCode];
      this.loadSessions();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  activityLabel(): string {
    return this.i18n.translate(`corralWorkSession.activity.${this.activityCode}`);
  }

  onCompanyChange(uuid: string): void {
    this.selectedCompany = uuid;
    this.quickRanchUuid = '';
    this.filterRanchUuid = '';
    this.loadRanches();
  }

  loadCompanies(): void {
    this.loading = true;
    this.userManagementService
      .getCompanies()
      .pipe(
        catchError(() => of([])),
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

  loadRanches(): void {
    const company = this.isSaasOwner
      ? this.selectedCompany.trim() || undefined
      : this.sessionService.getUuidCompany() ?? undefined;

    if (this.isSaasOwner && !company) {
      this.ranchRows = [];
      return;
    }

    this.userManagementService.getRanches(company).subscribe({
      next: (ranches) => {
        this.ranchRows = ranches;
        this.ranchNameByUuid = new Map(ranches.map((r) => [r.uuid_ranch, r.name]));
        if (ranches.length === 1 && !this.quickRanchUuid) {
          this.quickRanchUuid = ranches[0].uuid_ranch;
        }
      }
    });
  }

  loadSessions(): void {
    this.loading = true;
    this.errorMessage = '';
    this.sessions = [];
    this.api
      .listSessions({
        ranch_uuid: this.filterRanchUuid || undefined,
        work_date: this.filterWorkDate || undefined,
        activity_code: this.activityCode
      })
      .pipe(
        catchError(() => {
          this.errorMessage = this.i18n.translate('corralWorkSession.errorLoadList');
          return of([]);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((sessions) => {
        this.sessions = sessions;
      });
  }

  statusLabel(status: string): string {
    return this.i18n.translate(`corralWorkSession.status.${status}`);
  }

  startActivitySession(): void {
    this.errorMessage = '';
    if (!this.quickRanchUuid || !this.quickWorkDate) {
      this.errorMessage = this.i18n.translate('corralWorkSession.errorRequiredFields');
      return;
    }

    const shortcut = getCorralActivityShortcutConfig(this.activityCode);
    this.starting = true;
    this.quickStart
      .startQuickSession({
        activityCode: this.activityCode,
        ranchUuid: this.quickRanchUuid,
        workDate: this.quickWorkDate,
        responsiblePerson: this.quickResponsiblePerson.trim() || null,
        workMode: shortcut.defaultWorkMode
      })
      .pipe(
        catchError((err) => {
          this.errorMessage =
            translateApiError(this.i18n, err, 'corralActivityShortcut.errorStart');
          return of(null);
        }),
        finalize(() => {
          this.starting = false;
        })
      )
      .subscribe((session) => {
        if (!session) return;
        this.navigateToWork(session.uuid_corral_work_session);
      });
  }

  workSession(session: CorralWorkSessionDto): void {
    if (session.status === 'CLOSED') {
      this.navigateToWork(session.uuid_corral_work_session);
      return;
    }

    const shortcut = getCorralActivityShortcutConfig(this.activityCode);
    if (!session.work_configured || session.status === 'DRAFT') {
      this.startingWork = true;
      this.errorMessage = '';
      this.quickStart
        .prepareAndStartSession(session.uuid_corral_work_session, this.activityCode, shortcut.defaultWorkMode)
        .pipe(
          catchError((err) => {
            this.errorMessage =
              translateApiError(this.i18n, err, 'corralWorkSession.errorStartWork');
            return of(null);
          }),
          finalize(() => {
            this.startingWork = false;
          })
        )
        .subscribe((updated) => {
          if (updated) {
            this.navigateToWork(session.uuid_corral_work_session);
          }
        });
      return;
    }

    this.navigateToWork(session.uuid_corral_work_session);
  }

  viewDetail(session: CorralWorkSessionDto): void {
    void this.router.navigate(['/corral-work-session', session.uuid_corral_work_session], {
      queryParams: { entry: 'activity', activity: this.activityCode }
    });
  }

  private navigateToWork(sessionUuid: string): void {
    void this.router.navigate(['/corral-work-session', sessionUuid, 'work'], {
      queryParams: { entry: 'activity', activity: this.activityCode }
    });
  }
}
