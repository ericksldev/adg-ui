import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { translateApiError } from 'src/app/core/utils/api-error.util';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { RanchOption } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import {
  CorralActivityCode,
  isCorralActivityCode
} from '../../constants/corral-activities';
import { CorralWorkSessionDto } from '../../models/corral-work-session.model';
import { CorralWorkSessionApiService } from '../../services/corral-work-session-api.service';

@Component({
  selector: 'app-corral-work-session-list',
  templateUrl: './corral-work-session-list.component.html',
  styleUrls: ['./corral-work-session-list.component.scss']
})
export class CorralWorkSessionListComponent implements OnInit {
  loading = false;
  startingWork = false;
  errorMessage = '';
  sessions: CorralWorkSessionDto[] = [];
  ranchRows: RanchOption[] = [];
  ranchNameByUuid = new Map<string, string>();

  filterRanchUuid = '';
  filterWorkDate = '';
  focusedActivityCode: CorralActivityCode | null = null;

  constructor(
    private readonly api: CorralWorkSessionApiService,
    private readonly userManagementService: UserManagementService,
    private readonly sessionService: SessionService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    readonly i18n: I18nService
  ) {}

  ngOnInit(): void {
    const activityCode = this.route.snapshot.paramMap.get('activityCode');
    if (activityCode) {
      if (!isCorralActivityCode(activityCode)) {
        void this.router.navigate(['/corral-work-session']);
        return;
      }
      this.focusedActivityCode = activityCode;
    }
    this.loadRanches();
    this.loadSessions();
  }

  get displaySessions(): CorralWorkSessionDto[] {
    if (!this.focusedActivityCode) {
      return this.sessions;
    }
    return this.sessions.filter((session) => this.sessionIncludesActivity(session, this.focusedActivityCode as CorralActivityCode));
  }

  get listTitleKey(): string {
    return this.focusedActivityCode ? 'corralWorkSession.activityListTitle' : 'corralWorkSession.listTitle';
  }

  get listSubtitleKey(): string {
    return this.focusedActivityCode ? 'corralWorkSession.activityListSubtitle' : 'corralWorkSession.listSubtitleV2';
  }

  get createButtonKey(): string {
    return this.focusedActivityCode ? 'corralWorkSession.createActivityButton' : 'corralWorkSession.createButton';
  }

  loadRanches(): void {
    const company = this.sessionService.getUuidCompany() ?? undefined;
    this.userManagementService.getRanches(company).subscribe({
      next: (ranches) => {
        this.ranchRows = ranches;
        this.ranchNameByUuid = new Map(ranches.map((r) => [r.uuid_ranch, r.name]));
      }
    });
  }

  loadSessions(): void {
    this.loading = true;
    this.errorMessage = '';
    this.api
      .listSessions({
        ranch_uuid: this.filterRanchUuid || undefined,
        work_date: this.filterWorkDate || undefined
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

  activityLabel(activity: string): string {
    return this.i18n.translate(`corralWorkSession.activity.${activity}`);
  }

  focusedActivityLabel(): string {
    return this.focusedActivityCode ? this.activityLabel(this.focusedActivityCode) : '';
  }

  statusLabel(status: string): string {
    return this.i18n.translate(`corralWorkSession.status.${status}`);
  }

  goCreate(): void {
    if (this.focusedActivityCode) {
      void this.router.navigate(['/corral-work-session', 'create'], {
        queryParams: { activity: this.focusedActivityCode }
      });
      return;
    }
    void this.router.navigate(['/corral-work-session/create']);
  }

  backToCorralService(): void {
    void this.router.navigate(['/corral-work-session']);
  }

  private sessionIncludesActivity(session: CorralWorkSessionDto, activityCode: CorralActivityCode): boolean {
    if (session.planned_activities?.includes(activityCode)) {
      return true;
    }
    return (session.steps ?? []).some((step) => step.activities.includes(activityCode));
  }

  loadAnimals(session: CorralWorkSessionDto): void {
    void this.router.navigate(['/corral-work-session', session.uuid_corral_work_session, 'load-animals']);
  }

  setupWork(session: CorralWorkSessionDto): void {
    void this.router.navigate(['/corral-work-session', session.uuid_corral_work_session, 'setup']);
  }

  canWork(session: CorralWorkSessionDto): boolean {
    return Boolean(session.work_configured && session.status !== 'CLOSED');
  }

  needsSetup(session: CorralWorkSessionDto): boolean {
    return !session.work_configured && session.status !== 'CLOSED';
  }

  workSession(session: CorralWorkSessionDto): void {
    if (session.status === 'CLOSED') {
      void this.router.navigate(['/corral-work-session', session.uuid_corral_work_session, 'work']);
      return;
    }
    if (!session.work_configured) {
      this.setupWork(session);
      return;
    }
    if (!this.canWork(session)) return;
    this.startingWork = true;
    this.errorMessage = '';

    const navigate = () => {
      void this.router.navigate(['/corral-work-session', session.uuid_corral_work_session, 'work']);
    };

    if (session.status === 'DRAFT') {
      this.api
        .startSession(session.uuid_corral_work_session)
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
          if (updated) navigate();
        });
      return;
    }

    this.startingWork = false;
    navigate();
  }

  viewDetail(session: CorralWorkSessionDto): void {
    void this.router.navigate(['/corral-work-session', session.uuid_corral_work_session]);
  }
}
