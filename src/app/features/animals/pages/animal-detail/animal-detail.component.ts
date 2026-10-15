import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { forkJoin, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { hasPermission, Permission } from 'src/app/shared/constants/permissions';
import { AnimalDeactivateDialogComponent } from '../../components/animal-deactivate-dialog/animal-deactivate-dialog.component';
import { CategoryMultiSelectOption } from '../../components/category-multi-select/category-multi-select.component';
import { AnimalDetail } from '../../models/animal-detail.model';
import { AnimalAttendanceRow } from '../../models/animal-attendance.model';
import { AnimalService } from '../../services/animal.service';
import { LivestockCategoryApiService } from 'src/app/features/configuration/services/livestock-category-api.service';
import {
  AnimalCategoryAssignment,
  AnimalCategoryHistoryEntry,
  LivestockCategory
} from 'src/app/features/configuration/models/livestock-category.model';
import {
  animalBreedLabelKey,
  animalExitTypeLabelKey,
  animalOriginLabelKey,
  animalStatusLabelKey
} from '../../utils/animal-display.util';

@Component({
  selector: 'app-animal-detail',
  templateUrl: './animal-detail.component.html',
  styleUrls: ['./animal-detail.component.scss']
})
export class AnimalDetailComponent implements OnInit, OnDestroy {
  animal: AnimalDetail | null = null;
  attendance: AnimalAttendanceRow | null = null;
  assignments: AnimalCategoryAssignment[] = [];
  categoryHistory: AnimalCategoryHistoryEntry[] = [];
  availableCategories: LivestockCategory[] = [];
  selectedCategoryIds: string[] = [];
  categoryReason = '';
  categoryError = '';
  isLoading = true;
  attendanceLoading = false;
  errorMessage = '';
  attendanceError = '';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly animalService: AnimalService,
    private readonly livestockCategoryApi: LivestockCategoryApiService,
    private readonly sessionService: SessionService,
    private readonly i18nService: I18nService,
    private readonly modalService: NgbModal
  ) {}

  get canAnimalWrite(): boolean {
    return hasPermission(this.sessionService.getRoles(), Permission.ANIMAL_WRITE);
  }

  get isActive(): boolean {
    return this.animal?.is_active !== false;
  }

  get assignableCategoryOptions(): CategoryMultiSelectOption[] {
    const assigned = new Set(this.assignments.map((assignment) => assignment.category_uuid));
    return this.availableCategories
      .filter((category) => !assigned.has(category.category_uuid))
      .map((category) => ({ value: category.category_uuid, label: category.name }));
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('animalUuid');
      if (!id) {
        void this.router.navigate(['/animal']);
        return;
      }
      this.load(id);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  breedLabel(code?: string | null): string {
    return this.i18nService.translate(animalBreedLabelKey(code));
  }

  statusLabel(status?: string | null): string {
    return this.i18nService.translate(animalStatusLabelKey(status));
  }

  originLabel(origin?: string | null): string {
    return this.i18nService.translate(animalOriginLabelKey(origin));
  }

  exitTypeLabel(exitType?: string | null): string {
    return this.i18nService.translate(animalExitTypeLabelKey(exitType));
  }

  sessionStatusLabel(status: string): string {
    const key = `corralWorkSession.status.${status}`;
    const label = this.i18nService.translate(key);
    return label === key ? status : label;
  }

  attendanceReviewLink(): { commands: string[]; queryParams: Record<string, string> } {
    const queryParams: Record<string, string> = {};
    if (this.animal?.ranch_uuid) {
      queryParams['ranch_uuid'] = this.animal.ranch_uuid;
    }
    if (this.animal?.current_paddock_uuid) {
      queryParams['paddock_uuid'] = this.animal.current_paddock_uuid;
    }
    return { commands: ['/animal/attendance'], queryParams };
  }

  openDeactivateDialog(): void {
    if (!this.animal?.animal_uuid || !this.isActive || !this.canAnimalWrite) {
      return;
    }
    const modalRef = this.modalService.open(AnimalDeactivateDialogComponent, {
      centered: true,
      backdrop: 'static',
      size: 'lg'
    });
    const dialog = modalRef.componentInstance as AnimalDeactivateDialogComponent;
    dialog.animalUuid = this.animal.animal_uuid;
    dialog.animalLabel = this.animal.registration_number;
    modalRef.closed.pipe(takeUntil(this.destroy$)).subscribe((result) => {
      if (result === 'success') {
        void this.router.navigate(['/animal/inactive']);
      }
    });
  }

  private load(animalUuid: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.attendanceError = '';
    this.animal = null;
    this.attendance = null;
    this.animalService.getAnimalById(animalUuid, true).subscribe({
      next: (row) => {
        this.animal = row;
        this.isLoading = false;
        this.loadAttendance(row.ranch_uuid, row.animal_uuid);
        this.loadCategories(row.animal_uuid);
      },
      error: () => {
        this.errorMessage = this.i18nService.translate('animal.detailNotFound');
        this.isLoading = false;
      }
    });
  }

  assignCategory(): void {
    if (!this.animal || !this.selectedCategoryIds.length) {
      return;
    }
    const animalUuid = this.animal.animal_uuid;
    const reason = this.categoryReason || null;
    forkJoin(this.selectedCategoryIds.map((categoryUuid) => this.livestockCategoryApi.assign(animalUuid, categoryUuid, reason))).subscribe({
      next: () => {
        this.selectedCategoryIds = [];
        this.categoryReason = '';
        this.loadCategories(animalUuid);
      },
      error: (error) => {
        this.categoryError = error?.error?.description || this.i18nService.translate('livestockCategory.loadError');
      }
    });
  }

  removeCategory(categoryUuid: string): void {
    if (!this.animal) {
      return;
    }
    this.livestockCategoryApi.remove(this.animal.animal_uuid, categoryUuid, this.categoryReason || null).subscribe({
      next: () => this.loadCategories(this.animal!.animal_uuid),
      error: (error) => {
        this.categoryError = error?.error?.description || this.i18nService.translate('livestockCategory.loadError');
      }
    });
  }

  private loadCategories(animalUuid: string): void {
    this.categoryError = '';
    this.livestockCategoryApi.listAnimalCategories(animalUuid).subscribe({
      next: (rows) => {
        this.assignments = rows;
      },
      error: () => {
        this.categoryError = this.i18nService.translate('livestockCategory.loadError');
      }
    });
    this.livestockCategoryApi.listHistory(animalUuid).subscribe({
      next: (rows) => {
        this.categoryHistory = rows;
      },
      error: () => undefined
    });
    this.livestockCategoryApi.listCategories(false).subscribe({
      next: (rows) => {
        this.availableCategories = rows;
      },
      error: () => undefined
    });
  }

  private loadAttendance(ranchUuid: string, animalUuid: string): void {
    this.attendanceLoading = true;
    this.attendanceError = '';
    this.animalService.reviewAttendance({ ranch_uuid: ranchUuid, animal_uuid: animalUuid }).subscribe({
      next: (result) => {
        this.attendance = result.review.animals[0] ?? null;
        this.attendanceLoading = false;
      },
      error: () => {
        this.attendance = null;
        this.attendanceError = this.i18nService.translate('animal.attendance.error');
        this.attendanceLoading = false;
      }
    });
  }
}
