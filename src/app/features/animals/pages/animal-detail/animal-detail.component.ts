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
  isLoading = true;
  errorMessage = '';

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
    this.animal = null;
    this.animalService.getAnimalById(animalUuid, true).subscribe({
      next: (row) => {
        this.animal = row;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = this.i18nService.translate('animal.detailNotFound');
        this.isLoading = false;
      }
    });
  }
}
