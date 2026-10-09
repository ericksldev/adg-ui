import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { hasPermission, Permission } from 'src/app/shared/constants/permissions';
import { AnimalDeactivateDialogComponent } from '../../components/animal-deactivate-dialog/animal-deactivate-dialog.component';
import { AnimalDetail } from '../../models/animal-detail.model';
import { AnimalAttendanceRow } from '../../models/animal-attendance.model';
import { AnimalService } from '../../services/animal.service';
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
  isLoading = true;
  attendanceLoading = false;
  errorMessage = '';
  attendanceError = '';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly animalService: AnimalService,
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
      },
      error: () => {
        this.errorMessage = this.i18nService.translate('animal.detailNotFound');
        this.isLoading = false;
      }
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
