import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, of, switchMap } from 'rxjs';
import { translateApiError } from 'src/app/core/utils/api-error.util';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { RanchOption } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import {
  CORRAL_ACTIVITY_CODES,
  CorralActivityCode,
  isCorralActivityCode
} from '../../constants/corral-activities';
import { CorralWorkSessionDto } from '../../models/corral-work-session.model';
import { CorralWorkSessionApiService } from '../../services/corral-work-session-api.service';

interface ActivitySetupRow {
  activity_code: CorralActivityCode;
  enabled: boolean;
  step_order: number | null;
}

@Component({
  selector: 'app-corral-work-session-setup',
  templateUrl: './corral-work-session-setup.component.html',
  styleUrls: ['./corral-work-session-setup.component.scss']
})
export class CorralWorkSessionSetupComponent implements OnInit {
  readonly activityCodes = CORRAL_ACTIVITY_CODES;

  sessionUuid = '';
  session: CorralWorkSessionDto | null = null;
  ranchName = '';
  loading = true;
  saving = false;
  errorMessage = '';
  activityRows: ActivitySetupRow[] = [];
  returnToWork = false;
  entryActivityCode: CorralActivityCode | null = null;
  duringWork = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly api: CorralWorkSessionApiService,
    private readonly userManagementService: UserManagementService,
    private readonly sessionService: SessionService,
    readonly i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.sessionUuid = this.route.snapshot.paramMap.get('sessionUuid') ?? '';
    this.returnToWork = this.route.snapshot.queryParamMap.get('returnTo') === 'work';
    const entry = this.route.snapshot.queryParamMap.get('entry');
    const activity = this.route.snapshot.queryParamMap.get('activity');
    if (entry === 'activity' && isCorralActivityCode(activity)) {
      this.entryActivityCode = activity;
    }
    if (!this.sessionUuid) {
      void this.router.navigate(['/corral-work-session']);
      return;
    }
    this.loadSession();
  }

  get isDuringWork(): boolean {
    return this.duringWork;
  }

  isActivityLocked(row: ActivitySetupRow): boolean {
    return this.isDuringWork && row.enabled;
  }

  private createActivityRowsFromSession(session: CorralWorkSessionDto): ActivitySetupRow[] {
    const stepByActivity = new Map<CorralActivityCode, number>();
    for (const step of session.steps ?? []) {
      for (const code of step.activities) {
        stepByActivity.set(code, step.step_order);
      }
    }
    return CORRAL_ACTIVITY_CODES.map((code) => ({
      activity_code: code,
      enabled: stepByActivity.has(code),
      step_order: stepByActivity.get(code) ?? null
    }));
  }

  private createDefaultActivityRows(): ActivitySetupRow[] {
    return CORRAL_ACTIVITY_CODES.map((code) => ({
      activity_code: code,
      enabled: false,
      step_order: null
    }));
  }

  loadSession(): void {
    this.loading = true;
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
        if (session.status === 'CLOSED') {
          void this.router.navigate(['/corral-work-session']);
          return;
        }
        this.session = session;
        this.duringWork = session.status === 'IN_PROGRESS';
        this.loadRanchName(session.ranch_uuid);
        this.activityRows =
          session.steps?.length
            ? this.createActivityRowsFromSession(session)
            : this.applyFocusedActivity(this.createDefaultActivityRows());
      });
  }

  private applyFocusedActivity(rows: ActivitySetupRow[]): ActivitySetupRow[] {
    const activity = this.route.snapshot.queryParamMap.get('activity');
    if (!isCorralActivityCode(activity)) {
      return rows;
    }
    return rows.map((row) =>
      row.activity_code === activity
        ? { ...row, enabled: true, step_order: 1 }
        : row
    );
  }

  private loadRanchName(ranchUuid: string): void {
    const company = this.sessionService.getUuidCompany() ?? undefined;
    this.userManagementService.getRanches(company).subscribe({
      next: (ranches: RanchOption[]) => {
        this.ranchName = ranches.find((r) => r.uuid_ranch === ranchUuid)?.name ?? ranchUuid;
      }
    });
  }

  activityLabel(code: CorralActivityCode): string {
    return this.i18n.translate(`corralWorkSession.activity.${code}`);
  }

  onActivityToggle(row: ActivitySetupRow, checked: boolean): void {
    if (this.isActivityLocked(row) && !checked) {
      return;
    }
    row.enabled = checked;
    if (checked && (row.step_order === null || row.step_order < 1)) {
      row.step_order = 1;
    }
    if (!checked) {
      row.step_order = null;
    }
  }

  private buildStepsPayload() {
    const enabledRows = this.activityRows.filter((row) => row.enabled && row.step_order && row.step_order >= 1);
    const stepOrders = [...new Set(enabledRows.map((row) => row.step_order as number))].sort((a, b) => a - b);
    return stepOrders.map((stepOrder) => ({
      step_order: stepOrder,
      label: null,
      activity_codes: enabledRows
        .filter((row) => row.step_order === stepOrder)
        .map((row) => row.activity_code)
    }));
  }

  submit(): void {
    this.errorMessage = '';
    const steps = this.buildStepsPayload();
    if (steps.length === 0 || steps.some((step) => step.activity_codes.length === 0)) {
      this.errorMessage = this.i18n.translate('corralWorkSession.errorNoActivities');
      return;
    }

    this.saving = true;
    const save$ = this.duringWork
      ? this.api.extendWorkConfiguration(this.sessionUuid, { steps })
      : this.api.configureWork(this.sessionUuid, { steps }).pipe(
          switchMap((session) => {
            if (!session) return of(null);
            return this.api.startSession(this.sessionUuid).pipe(catchError(() => of(session)));
          })
        );

    save$
      .pipe(
        catchError((err) => {
          this.errorMessage =
            translateApiError(this.i18n, err, 'corralWorkSession.errorConfigureWork');
          return of(null);
        }),
        finalize(() => {
          this.saving = false;
        })
      )
      .subscribe((result) => {
        if (!result) return;
        this.navigateAfterSave();
      });
  }

  private navigateAfterSave(): void {
    if (this.returnToWork) {
      const queryParams: Record<string, string> = {};
      if (this.entryActivityCode) {
        queryParams['entry'] = 'activity';
        queryParams['activity'] = this.entryActivityCode;
      }
      void this.router.navigate(['/corral-work-session', this.sessionUuid, 'work'], { queryParams });
      return;
    }
    void this.router.navigate(['/corral-work-session', this.sessionUuid, 'work']);
  }

  backToList(): void {
    if (this.returnToWork) {
      this.navigateAfterSave();
      return;
    }
    if (this.entryActivityCode) {
      void this.router.navigate(['/corral-work-session', 'activity', this.entryActivityCode]);
      return;
    }
    void this.router.navigate(['/corral-work-session']);
  }
}
