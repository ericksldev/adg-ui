import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, of, Subject, takeUntil } from 'rxjs';
import { translateApiError } from 'src/app/core/utils/api-error.util';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { AnimalApiService, PaddockOptionDto } from 'src/app/features/animals/services/animal-api.service';
import { RanchOption } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import {
  CorralSessionSourceDto,
  CorralSessionWorkspaceDto,
  CorralStepGridDto,
  CorralWorkSessionDto
} from '../../models/corral-work-session.model';
import { CorralActivityCode, isCorralActivityCode } from '../../constants/corral-activities';
import { getCorralActivityShortcutConfig } from '../../constants/corral-activity-entry.config';
import { CorralWorkSessionApiService } from '../../services/corral-work-session-api.service';
import { notAvailableLabel, stepDisplayLabel, translateCorralFilterKey, translateCorralFilterValue } from 'src/app/core/utils/i18n-display.util';

@Component({
  selector: 'app-corral-work-session-detail',
  templateUrl: './corral-work-session-detail.component.html',
  styleUrls: ['./corral-work-session-detail.component.scss']
})
export class CorralWorkSessionDetailComponent implements OnInit, OnDestroy {
  sessionUuid = '';
  loading = true;
  loadingWorkspace = false;
  errorMessage = '';
  session: CorralWorkSessionDto | null = null;
  workspace: CorralSessionWorkspaceDto | null = null;
  activeStepIndex = 0;
  ranchName = '';
  paddockNameByUuid = new Map<string, string>();
  activityFocusCode: CorralActivityCode | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly api: CorralWorkSessionApiService,
    private readonly animalApiService: AnimalApiService,
    private readonly userManagementService: UserManagementService,
    private readonly sessionService: SessionService,
    readonly i18n: I18nService
  ) {}

  ngOnInit(): void {
    const entry = this.route.snapshot.queryParamMap.get('entry');
    const activity = this.route.snapshot.queryParamMap.get('activity');
    if (entry === 'activity' && isCorralActivityCode(activity)) {
      this.activityFocusCode = activity;
    }

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const uuid = params.get('sessionUuid');
      if (!uuid) {
        void this.router.navigate(['/corral-work-session']);
        return;
      }
      this.sessionUuid = uuid;
      this.loadDetail();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get activeGrid(): CorralStepGridDto | null {
    return this.workspace?.grids[this.activeStepIndex] ?? null;
  }

  get canOpenWork(): boolean {
    return Boolean(this.session?.work_configured);
  }

  activityLabel(activity: string): string {
    return this.i18n.translate(`corralWorkSession.activity.${activity}`);
  }

  statusLabel(status: string): string {
    return this.i18n.translate(`corralWorkSession.status.${status}`);
  }

  workModeLabel(mode: string | undefined | null): string {
    if (!mode) return notAvailableLabel(this.i18n);
    return this.i18n.translate(`corralWorkSession.workMode.${mode}`);
  }

  stepLabel(stepOrder: number, label?: string | null): string {
    return stepDisplayLabel(this.i18n, stepOrder, label);
  }

  sourceLabel(source: CorralSessionSourceDto): string {
    if (source.source_type === 'PADDOCK' && source.paddock_uuid) {
      return this.paddockNameByUuid.get(source.paddock_uuid) ?? source.paddock_uuid;
    }
    if (source.source_type === 'FILTER') {
      const keyLabel = translateCorralFilterKey(this.i18n, source.filter_key);
      const valueLabel = translateCorralFilterValue(this.i18n, source.filter_value);
      return `${keyLabel}: ${valueLabel}`;
    }
    if (source.source_type === 'MANUAL' && source.animal_uuid) {
      return source.animal_uuid;
    }
    return this.i18n.translate(`corralWorkSession.sourceType.${source.source_type}`);
  }

  backToList(): void {
    if (this.activityFocusCode) {
      void this.router.navigate(getCorralActivityShortcutConfig(this.activityFocusCode).listRoute);
      return;
    }
    void this.router.navigate(['/corral-work-session']);
  }

  openWork(): void {
    void this.router.navigate(['/corral-work-session', this.sessionUuid, 'work'], {
      queryParams: this.workQueryParams()
    });
  }

  workSession(): void {
    if (!this.session || this.session.status === 'CLOSED') {
      this.openWork();
      return;
    }
    if (!this.session.work_configured) {
      void this.router.navigate(['/corral-work-session', this.sessionUuid, 'setup'], {
        queryParams: this.workQueryParams()
      });
      return;
    }
    if (this.session.status === 'DRAFT') {
      this.api.startSession(this.sessionUuid).subscribe({
        next: () => this.openWork(),
        error: (err) => {
          this.errorMessage =
            translateApiError(this.i18n, err, 'corralWorkSession.errorStartWork');
        }
      });
      return;
    }
    this.openWork();
  }

  private workQueryParams(): Record<string, string> | undefined {
    if (!this.activityFocusCode) {
      return undefined;
    }
    return { entry: 'activity', activity: this.activityFocusCode };
  }

  private loadDetail(): void {
    this.loading = true;
    this.errorMessage = '';
    this.session = null;
    this.workspace = null;
    this.activeStepIndex = 0;

    this.api
      .getSession(this.sessionUuid)
      .pipe(
        catchError(() => {
          this.errorMessage = this.i18n.translate('corralWorkSession.errorLoadSession');
          return of(null);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((session) => {
        if (!session) return;
        this.session = session;
        this.loadRanchName(session.ranch_uuid);
        this.loadPaddocks(session.ranch_uuid);
        if (session.work_configured) {
          this.loadWorkspace();
        }
      });
  }

  private loadRanchName(ranchUuid: string): void {
    const company = this.sessionService.getUuidCompany() ?? undefined;
    this.userManagementService.getRanches(company).subscribe({
      next: (ranches: RanchOption[]) => {
        this.ranchName = ranches.find((r) => r.uuid_ranch === ranchUuid)?.name ?? ranchUuid;
      }
    });
  }

  private loadPaddocks(ranchUuid: string): void {
    this.animalApiService.getPaddocksForRanch(ranchUuid).subscribe({
      next: (paddocks: PaddockOptionDto[]) => {
        this.paddockNameByUuid = new Map(paddocks.map((p) => [p.paddock_uuid, p.name]));
      }
    });
  }

  private loadWorkspace(): void {
    this.loadingWorkspace = true;
    this.api
      .getWorkspace(this.sessionUuid)
      .pipe(
        catchError(() => of(null)),
        finalize(() => {
          this.loadingWorkspace = false;
        })
      )
      .subscribe((workspace) => {
        this.workspace = workspace;
      });
  }
}
