import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { translateApiError } from 'src/app/core/utils/api-error.util';
import { I18nService } from 'src/app/core/services/i18n.service';
import { AnimalApiService, PaddockOptionDto } from 'src/app/features/animals/services/animal-api.service';
import { RanchOption } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import { SessionService } from 'src/app/core/services/session.service';
import {
  AnimalLookupDto,
  AnimalWorkRecordDto,
  CorralWorkSessionDto
} from '../../models/corral-work-session.model';
import { CorralWorkSessionApiService } from '../../services/corral-work-session-api.service';

@Component({
  selector: 'app-corral-work-session-active',
  templateUrl: './corral-work-session-active.component.html',
  styleUrls: ['./corral-work-session-active.component.scss']
})
export class CorralWorkSessionActiveComponent implements OnInit {
  sessionUuid = '';
  loading = true;
  saving = false;
  closing = false;
  errorMessage = '';
  successMessage = '';

  session: CorralWorkSessionDto | null = null;
  records: AnimalWorkRecordDto[] = [];

  ranchName = '';
  paddockName = '';

  animalIdentifier = '';
  currentAnimal: AnimalLookupDto | null = null;
  formAttended = true;
  formCondition = '';
  formObservation = '';
  formReceivedMedical = false;

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
    this.sessionUuid = this.route.snapshot.paramMap.get('sessionUuid') ?? '';
    if (!this.sessionUuid) {
      void this.router.navigate(['/corral-work-session']);
      return;
    }
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.errorMessage = '';
    forkJoin({
      session: this.api.getSession(this.sessionUuid).pipe(catchError(() => of(null))),
      records: this.api.listAnimalRecords(this.sessionUuid).pipe(catchError(() => of([])))
    })
      .pipe(finalize(() => {
        this.loading = false;
      }))
      .subscribe(({ session, records }) => {
        if (!session) {
          this.errorMessage = this.i18n.translate('corralWorkSession.errorLoadSession');
          return;
        }
        this.session = session;
        this.records = records;
        this.loadLabels(session);
        if (session.status === 'DRAFT') {
          this.api.startSession(this.sessionUuid).subscribe({
            next: (updated) => {
              this.session = updated;
            }
          });
        }
      });
  }

  private loadLabels(session: CorralWorkSessionDto): void {
    const company = this.sessionService.getUuidCompany() ?? undefined;
    this.userManagementService.getRanches(company).subscribe({
      next: (ranches: RanchOption[]) => {
        this.ranchName = ranches.find((r) => r.uuid_ranch === session.ranch_uuid)?.name ?? session.ranch_uuid;
      }
    });
    this.animalApiService.getPaddocksForRanch(session.ranch_uuid).subscribe({
      next: (paddocks: PaddockOptionDto[]) => {
        this.paddockName = paddocks.find((p) => p.paddock_uuid === session.paddock_uuid)?.name ?? session.paddock_uuid;
      }
    });
  }

  activityLabel(activity: string): string {
    return this.i18n.translate(`corralWorkSession.activity.${activity}`);
  }

  statusLabel(status: string): string {
    return this.i18n.translate(`corralWorkSession.status.${status}`);
  }

  lookupAnimal(): void {
    this.errorMessage = '';
    this.successMessage = '';
    const id = this.animalIdentifier.trim();
    if (!id) {
      return;
    }
    this.api.lookupAnimal(this.sessionUuid, id).subscribe({
      next: (animal) => {
        this.currentAnimal = animal;
        const existing = this.records.find((r) => r.uuid_animal === animal.animal_uuid);
        if (existing) {
          this.formAttended = existing.attended;
          this.formCondition = existing.condition ?? '';
          this.formObservation = existing.observation ?? '';
          this.formReceivedMedical = existing.received_medical;
        } else {
          this.formAttended = true;
          this.formCondition = '';
          this.formObservation = '';
          this.formReceivedMedical = this.session?.planned_activities.includes('HEALTH') ?? false;
        }
      },
      error: (err) => {
        this.currentAnimal = null;
        this.errorMessage = translateApiError(this.i18n, err, 'corralWorkSession.errorAnimalNotFound');
      }
    });
  }

  onIdentifierKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.lookupAnimal();
    }
  }

  saveRecord(): void {
    if (!this.currentAnimal) {
      this.errorMessage = this.i18n.translate('corralWorkSession.errorLookupFirst');
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.api
      .upsertAnimalRecord(this.sessionUuid, {
        uuid_animal: this.currentAnimal.animal_uuid,
        attended: this.formAttended,
        condition: this.formCondition,
        observation: this.formObservation,
        received_medical: this.formReceivedMedical,
        medicine_uuid: this.session?.planned_medicine_uuid ?? null
      })
      .pipe(
        catchError((err) => {
          this.errorMessage = translateApiError(this.i18n, err, 'corralWorkSession.errorSaveRecord');
          return of(null);
        }),
        finalize(() => {
          this.saving = false;
        })
      )
      .subscribe((record) => {
        if (!record) {
          return;
        }
        const idx = this.records.findIndex((r) => r.uuid_animal === record.uuid_animal);
        if (idx >= 0) {
          this.records = [...this.records.slice(0, idx), record, ...this.records.slice(idx + 1)];
        } else {
          this.records = [...this.records, record];
        }
        this.successMessage = this.i18n.translate('corralWorkSession.recordSaved');
        this.animalIdentifier = '';
        this.currentAnimal = null;
      });
  }

  closeSession(): void {
    if (!this.session || this.session.status === 'CLOSED') {
      return;
    }
    this.closing = true;
    this.api
      .closeSession(this.sessionUuid)
      .pipe(
        catchError((err) => {
          this.errorMessage = translateApiError(this.i18n, err, 'corralWorkSession.errorClose');
          return of(null);
        }),
        finalize(() => {
          this.closing = false;
        })
      )
      .subscribe((session) => {
        if (session) {
          this.session = session;
          this.successMessage = this.i18n.translate('corralWorkSession.sessionClosed');
        }
      });
  }

  backToList(): void {
    void this.router.navigate(['/corral-work-session']);
  }
}
