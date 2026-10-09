import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { translateApiError } from 'src/app/core/utils/api-error.util';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { RanchOption } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import { PendingAnimalBatchNavigationState } from 'src/app/features/animals/models/animal-batch-pending-handoff.model';
import { hasPermission, Permission } from 'src/app/shared/constants/permissions';
import { PendingAnimalRegistrationDto } from '../../models/corral-work-session.model';
import { CorralWorkSessionApiService } from '../../services/corral-work-session-api.service';

@Component({
  selector: 'app-pending-animal-registration-list',
  templateUrl: './pending-animal-registration-list.component.html',
  styleUrls: ['./pending-animal-registration-list.component.scss']
})
export class PendingAnimalRegistrationListComponent implements OnInit {
  loading = false;
  errorMessage = '';
  rows: PendingAnimalRegistrationDto[] = [];
  ranchRows: RanchOption[] = [];
  ranchNameByUuid = new Map<string, string>();
  filterRanchUuid = '';
  readonly canRegisterAnimal: boolean;
  private readonly selectedKeys = new Set<string>();

  constructor(
    private readonly api: CorralWorkSessionApiService,
    private readonly userManagementService: UserManagementService,
    private readonly sessionService: SessionService,
    private readonly router: Router,
    readonly i18n: I18nService
  ) {
    this.canRegisterAnimal = hasPermission(this.sessionService.getRoles(), Permission.ANIMAL_WRITE);
  }

  ngOnInit(): void {
    this.loadRanches();
    this.loadRows();
  }

  loadRanches(): void {
    const company = this.sessionService.getUuidCompany() ?? undefined;
    this.userManagementService.getRanches(company).subscribe({
      next: (ranches) => {
        this.ranchRows = ranches;
        this.ranchNameByUuid = new Map(ranches.map((ranch) => [ranch.uuid_ranch, ranch.name]));
      }
    });
  }

  loadRows(): void {
    this.loading = true;
    this.errorMessage = '';
    this.api
      .listPendingRegistrations({
        ranch_uuid: this.filterRanchUuid || undefined
      })
      .pipe(
        catchError((err) => {
          this.errorMessage = translateApiError(this.i18n, err, 'pendingAnimalRegistration.errorLoad');
          return of([] as PendingAnimalRegistrationDto[]);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((rows) => {
        this.rows = rows;
        this.selectedKeys.clear();
      });
  }

  rowKey(row: PendingAnimalRegistrationDto): string {
    return `${row.ranch_uuid}|${row.registration_number.trim().toLowerCase()}`;
  }

  isSelected(row: PendingAnimalRegistrationDto): boolean {
    return this.selectedKeys.has(this.rowKey(row));
  }

  get selectedCount(): number {
    return this.rows.filter((row) => this.selectedKeys.has(this.rowKey(row))).length;
  }

  get allSelected(): boolean {
    return this.rows.length > 0 && this.selectedCount === this.rows.length;
  }

  get someSelected(): boolean {
    return this.selectedCount > 0 && !this.allSelected;
  }

  toggleRow(row: PendingAnimalRegistrationDto, checked: boolean): void {
    const key = this.rowKey(row);
    if (checked) {
      this.selectedKeys.add(key);
      return;
    }
    this.selectedKeys.delete(key);
  }

  toggleAll(checked: boolean): void {
    this.selectedKeys.clear();
    if (!checked) {
      return;
    }
    for (const row of this.rows) {
      this.selectedKeys.add(this.rowKey(row));
    }
  }

  registerSelected(): void {
    const selected = this.rows.filter((row) => this.selectedKeys.has(this.rowKey(row)));
    if (selected.length === 0) {
      return;
    }
    const state: PendingAnimalBatchNavigationState = {
      fromPendingRegistrations: true,
      rows: selected.map((row) => ({
        registrationNumber: row.registration_number,
        ranchUuid: row.ranch_uuid
      }))
    };
    void this.router.navigate(['/animal/register/batch'], { state });
  }

  statusLabel(status: string): string {
    return this.i18n.translate(`corralWorkSession.status.${status}`);
  }

  register(row: PendingAnimalRegistrationDto): void {
    void this.router.navigate(['/animal/register/individual'], {
      queryParams: {
        ranchUuid: row.ranch_uuid,
        registrationNumber: row.registration_number,
        fromPending: '1'
      }
    });
  }

  openSession(sessionUuid: string): void {
    void this.router.navigate(['/corral-work-session', sessionUuid]);
  }
}
