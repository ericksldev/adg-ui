import { Injectable } from '@angular/core';
import { Observable, of, switchMap } from 'rxjs';
import { CorralActivityCode, CorralStepWorkMode } from '../constants/corral-activities';
import { CorralWorkSessionDto } from '../models/corral-work-session.model';
import { CorralWorkSessionApiService } from './corral-work-session-api.service';

export interface QuickStartActivitySessionParams {
  activityCode: CorralActivityCode;
  ranchUuid: string;
  workDate: string;
  responsiblePerson?: string | null;
  notes?: string | null;
  workMode?: CorralStepWorkMode;
}

@Injectable({
  providedIn: 'root'
})
export class CorralActivityQuickStartService {
  constructor(private readonly api: CorralWorkSessionApiService) {}

  configureActivitySession(
    sessionUuid: string,
    activityCode: CorralActivityCode,
    workMode: CorralStepWorkMode = 'SCAN_DYNAMIC'
  ): Observable<CorralWorkSessionDto> {
    return this.api.configureWork(sessionUuid, {
      steps: [
        {
          step_order: 1,
          label: null,
          work_mode: workMode,
          activity_codes: [activityCode]
        }
      ]
    });
  }

  startQuickSession(params: QuickStartActivitySessionParams): Observable<CorralWorkSessionDto> {
    const workMode = params.workMode ?? 'SCAN_DYNAMIC';
    return this.api
      .createSession({
        ranch_uuid: params.ranchUuid,
        work_date: params.workDate,
        responsible_person: params.responsiblePerson ?? null,
        notes: params.notes ?? null
      })
      .pipe(
        switchMap((session) =>
          this.configureActivitySession(session.uuid_corral_work_session, params.activityCode, workMode)
        ),
        switchMap((session) => this.api.startSession(session.uuid_corral_work_session))
      );
  }

  prepareAndStartSession(
    sessionUuid: string,
    activityCode: CorralActivityCode,
    workMode: CorralStepWorkMode = 'SCAN_DYNAMIC'
  ): Observable<CorralWorkSessionDto> {
    return this.configureActivitySession(sessionUuid, activityCode, workMode).pipe(
      switchMap((session) => {
        if (session.status === 'DRAFT') {
          return this.api.startSession(sessionUuid);
        }
        return of(session);
      })
    );
  }
}
