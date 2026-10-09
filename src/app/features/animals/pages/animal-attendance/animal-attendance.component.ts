import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of, Subject } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { RanchOption } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import { ApiPagination } from 'src/app/shared/models/paginated-list.model';
import { pageNumbers } from 'src/app/shared/utils/list-query.util';
import { AnimalAttendanceMark, AnimalAttendanceRow, AnimalAttendanceSummary } from '../../models/animal-attendance.model';
import { AnimalApiService, PaddockOptionDto } from '../../services/animal-api.service';
import { AnimalService } from '../../services/animal.service';

const PAGE_SIZE = 25;

@Component({
  selector: 'app-animal-attendance',
  templateUrl: './animal-attendance.component.html',
  styleUrls: ['./animal-attendance.component.scss']
})
export class AnimalAttendanceComponent implements OnInit, OnDestroy {
  ranchOptions: RanchOption[] = [];
  paddockOptions: PaddockOptionDto[] = [];
  selectedRanch = '';
  selectedPaddock = '';
  dateFrom = '';
  dateTo = '';
  selectedStatus = 'ALL';
  rows: AnimalAttendanceRow[] = [];
  summary: AnimalAttendanceSummary = { expected: 0, present: 0, absent: 0 };
  page = 1;
  pagination: ApiPagination = {
    totalItems: 0,
    totalPages: 1,
    currentPage: 1,
    order: 'ASC',
    pageSize: PAGE_SIZE
  };
  isLoading = false;
  hasSearched = false;
  errorMessage = '';

  private readonly destroy$ = new Subject<void>();
  private reviewRequest = 0;
  private paddockRequest = 0;

  constructor(
    private readonly animalService: AnimalService,
    private readonly animalApi: AnimalApiService,
    private readonly userManagementService: UserManagementService,
    private readonly sessionService: SessionService,
    private readonly route: ActivatedRoute,
    private readonly i18n: I18nService
  ) {}

  ngOnInit(): void {
    const range = this.defaultRange();
    this.dateFrom = range.from;
    this.dateTo = range.to;

    const company = this.sessionService.getUuidCompany();
    this.userManagementService
      .getRanches(company ?? undefined)
      .pipe(catchError(() => of([])), takeUntil(this.destroy$))
      .subscribe((ranches) => {
        this.ranchOptions = [...ranches].sort((a, b) => a.name.localeCompare(b.name));
        const requestedRanch = this.route.snapshot.queryParamMap.get('ranch_uuid') ?? '';
        const requestedPaddock = this.route.snapshot.queryParamMap.get('paddock_uuid') ?? '';
        if (requestedRanch && this.ranchOptions.some((ranch) => ranch.uuid_ranch === requestedRanch)) {
          this.selectedRanch = requestedRanch;
        } else if (this.ranchOptions.length === 1) {
          this.selectedRanch = this.ranchOptions[0].uuid_ranch;
        }
        if (this.selectedRanch) {
          this.loadPaddocks(requestedPaddock, true);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get pageNumbersList(): number[] {
    return pageNumbers(this.pagination.totalPages);
  }

  onRanchChange(ranchUuid: string): void {
    this.selectedRanch = ranchUuid;
    this.selectedPaddock = '';
    this.paddockOptions = [];
    this.page = 1;
    if (!ranchUuid) {
      this.rows = [];
      this.hasSearched = false;
      return;
    }
    this.loadPaddocks('', true);
  }

  onPaddockChange(paddockUuid: string): void {
    this.selectedPaddock = paddockUuid;
    this.page = 1;
    this.loadReview();
  }

  onStatusChange(status: string): void {
    this.selectedStatus = status;
    this.page = 1;
    this.loadReview();
  }

  review(): void {
    this.page = 1;
    this.loadReview();
  }

  goToPage(pageNumber: number): void {
    if (pageNumber < 1 || pageNumber > this.pagination.totalPages || pageNumber === this.page) {
      return;
    }
    this.page = pageNumber;
    this.loadReview();
  }

  statusLabelKey(status: AnimalAttendanceMark): string {
    return status === 'PRESENT' ? 'animal.attendance.statusPresent' : 'animal.attendance.statusAbsent';
  }

  private loadPaddocks(preferredPaddock: string, searchAfter: boolean): void {
    const request = ++this.paddockRequest;
    this.animalApi
      .getPaddocksForRanch(this.selectedRanch)
      .pipe(catchError(() => of([])), takeUntil(this.destroy$))
      .subscribe((paddocks) => {
        if (request !== this.paddockRequest) {
          return;
        }
        this.paddockOptions = [...paddocks].sort((a, b) => a.name.localeCompare(b.name));
        if (preferredPaddock && this.paddockOptions.some((paddock) => paddock.paddock_uuid === preferredPaddock)) {
          this.selectedPaddock = preferredPaddock;
        }
        if (searchAfter) {
          this.loadReview();
        }
      });
  }

  private loadReview(): void {
    this.errorMessage = '';
    if (!this.selectedRanch) {
      this.errorMessage = this.i18n.translate('animal.attendance.ranchRequired');
      return;
    }
    if (!this.dateFrom || !this.dateTo || this.dateFrom > this.dateTo) {
      this.errorMessage = this.i18n.translate('animal.attendance.datesRequired');
      return;
    }

    const request = ++this.reviewRequest;
    this.isLoading = true;
    this.hasSearched = true;
    const status = this.selectedStatus === 'PRESENT' || this.selectedStatus === 'ABSENT'
      ? this.selectedStatus
      : undefined;

    this.animalService
      .reviewAttendance({
        ranch_uuid: this.selectedRanch,
        from: this.dateFrom,
        to: this.dateTo,
        paddock_uuid: this.selectedPaddock || undefined,
        attendance_status: status,
        page: this.page,
        size: PAGE_SIZE
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          if (request !== this.reviewRequest) {
            return;
          }
          this.rows = result.review.animals;
          this.summary = result.review.summary;
          this.pagination = result.pagination;
          this.page = result.pagination.currentPage;
          this.isLoading = false;
        },
        error: () => {
          if (request !== this.reviewRequest) {
            return;
          }
          this.rows = [];
          this.summary = { expected: 0, present: 0, absent: 0 };
          this.errorMessage = this.i18n.translate('animal.attendance.error');
          this.isLoading = false;
        }
      });
  }

  private defaultRange(): { from: string; to: string } {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 29);
    return { from: this.toDateInput(from), to: this.toDateInput(to) };
  }

  private toDateInput(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
