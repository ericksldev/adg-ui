import { Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { I18nService } from 'src/app/core/services/i18n.service';
import {
  isDuplicateRegistrationError,
  translateAnimalWriteError
} from 'src/app/core/utils/animal-write-error.util';
import { AnimalDetail } from '../../models/animal-detail.model';
import {
  AnimalApiService,
  BreedOptionDto,
  OwnerOptionDto,
  PaddockOptionDto,
  ParentOptionDto
} from '../../services/animal-api.service';
import { AnimalService } from '../../services/animal.service';

@Component({
  selector: 'app-animal-edit',
  templateUrl: './animal-edit.component.html',
  styleUrls: ['./animal-edit.component.scss']
})
export class AnimalEditComponent implements OnInit, OnDestroy {
  readonly form: FormGroup;
  readonly minBirthDate = '1900-01-01';
  readonly maxBirthDate = `${new Date().getFullYear() + 1}-12-31`;

  animal: AnimalDetail | null = null;
  feedback: { type: 'success' | 'error'; message: string } | null = null;
  isLoading = true;
  saving = false;

  breedRows: BreedOptionDto[] = [];
  ownerRows: OwnerOptionDto[] = [];
  paddockOptions: PaddockOptionDto[] = [];
  motherOptions: ParentOptionDto[] = [];
  fatherOptions: ParentOptionDto[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly i18n: I18nService,
    private readonly animalService: AnimalService,
    private readonly animalApi: AnimalApiService
  ) {
    this.form = this.fb.group({
      registrationNumber: [{ value: '', disabled: true }, Validators.required],
      chipNumber: [''],
      breedCode: [''],
      sex: ['MALE', Validators.required],
      originType: ['UNKNOWN', Validators.required],
      currentStatus: ['ACTIVE', Validators.required],
      motherRegistrationNumber: [''],
      fatherRegistrationNumber: [''],
      currentOwnerUuid: [''],
      currentPaddockUuid: [''],
      color: [''],
      birthDate: ['', [Validators.required, AnimalEditComponent.birthDateValidator]],
      description: ['']
    });
  }

  private static birthDateValidator(control: AbstractControl): ValidationErrors | null {
    const s = String(control.value ?? '').trim();
    if (!s) {
      return null;
    }
    const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/;
    const m = isoDate.exec(s);
    if (!m) {
      return { birthDateFormat: true };
    }
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const da = Number(m[3]);
    const utc = new Date(Date.UTC(y, mo - 1, da));
    if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== mo - 1 || utc.getUTCDate() !== da) {
      return { birthDateFormat: true };
    }
    const maxY = new Date().getFullYear() + 1;
    if (y < 1900 || y > maxY) {
      return { birthDateRange: true };
    }
    return null;
  }

  ngOnInit(): void {
    forkJoin({
      breeds: this.animalApi.getBreeds().pipe(catchError(() => of([]))),
      owners: this.animalApi.getOwners().pipe(catchError(() => of([])))
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ breeds, owners }) => {
        this.breedRows = breeds;
        this.ownerRows = owners;
      });

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('animalUuid');
      if (!id) {
        void this.router.navigate(['/animal']);
        return;
      }
      this.loadAnimal(id);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  breedLabel(code: string): string {
    return this.i18n.translate(`animal.breed.${code}`);
  }

  submit(): void {
    if (!this.animal) {
      return;
    }
    this.feedback = null;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.feedback = { type: 'error', message: this.i18n.translate('animal.editInvalid') };
      return;
    }

    const v = this.form.getRawValue() as {
      registrationNumber: string;
      chipNumber: string;
      breedCode: string;
      sex: string;
      originType: string;
      currentStatus: string;
      motherRegistrationNumber: string;
      fatherRegistrationNumber: string;
      currentOwnerUuid: string;
      currentPaddockUuid: string;
      color: string;
      birthDate: string;
      description: string;
    };

    const payload: Record<string, unknown> = {
      ranch_uuid: this.animal.ranch_uuid,
      breed_code: String(v.breedCode ?? '').trim() || null,
      registration_number: v.registrationNumber.trim(),
      sex: v.sex,
      origin_type: v.originType,
      current_status: v.currentStatus,
      birth_date: String(v.birthDate ?? '').trim(),
      chip_number: String(v.chipNumber ?? '').trim() || null,
      color: String(v.color ?? '').trim() || null,
      description: String(v.description ?? '').trim() || null,
      current_owner_uuid: String(v.currentOwnerUuid ?? '').trim() || null,
      current_paddock_uuid: String(v.currentPaddockUuid ?? '').trim() || null
    };

    const mother = String(v.motherRegistrationNumber ?? '').trim();
    const father = String(v.fatherRegistrationNumber ?? '').trim();
    payload['mother_registration_number'] = mother || null;
    payload['father_registration_number'] = father || null;

    this.saving = true;
    this.animalService.updateAnimal(this.animal.animal_uuid, payload).subscribe({
      next: () => {
        this.saving = false;
        this.feedback = { type: 'success', message: this.i18n.translate('animal.editSaveSuccess') };
        void this.router.navigate(['/animal', this.animal!.animal_uuid]);
      },
      error: (err) => {
        this.saving = false;
        const msg = translateAnimalWriteError(this.i18n, err, 'animal.editSaveError');
        if (isDuplicateRegistrationError(err)) {
          const ctrl = this.form.get('registrationNumber');
          if (ctrl) {
            ctrl.setErrors({ ...(ctrl.errors ?? {}), duplicate: true });
            ctrl.markAsTouched();
          }
        }
        this.feedback = { type: 'error', message: msg };
      }
    });
  }

  private loadAnimal(animalUuid: string): void {
    this.isLoading = true;
    this.animal = null;
    this.animalService.getAnimalById(animalUuid).subscribe({
      next: (row) => {
        this.animal = row;
        this.patchForm(row);
        this.loadRanchDependencies(row.ranch_uuid);
        this.isLoading = false;
      },
      error: () => {
        this.feedback = { type: 'error', message: this.i18n.translate('animal.detailNotFound') };
        this.isLoading = false;
      }
    });
  }

  private patchForm(row: AnimalDetail): void {
    this.form.patchValue({
      registrationNumber: row.registration_number,
      chipNumber: row.chip_number ?? '',
      breedCode: row.breed_code ?? '',
      sex: row.sex,
      originType: row.origin_type ?? 'UNKNOWN',
      currentStatus: row.current_status ?? 'ACTIVE',
      currentOwnerUuid: row.current_owner_uuid ?? '',
      currentPaddockUuid: row.current_paddock_uuid ?? '',
      color: row.color ?? '',
      birthDate: this.toDateInputValue(row.birth_date),
      description: row.description ?? ''
    });
  }

  private loadRanchDependencies(ranchUuid: string): void {
    forkJoin({
      paddocks: this.animalApi.getPaddocksForRanch(ranchUuid).pipe(catchError(() => of([]))),
      mothers: this.animalApi.getParentOptions(ranchUuid, 'FEMALE').pipe(catchError(() => of([]))),
      fathers: this.animalApi.getParentOptions(ranchUuid, 'MALE').pipe(catchError(() => of([])))
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ paddocks, mothers, fathers }) => {
        this.paddockOptions = paddocks;
        this.motherOptions = mothers;
        this.fatherOptions = fathers;
        this.resolveParentRegistrations();
      });
  }

  private resolveParentRegistrations(): void {
    if (!this.animal) {
      return;
    }
    const mother = this.motherOptions.find((p) => p.animal_uuid === this.animal?.mother_animal_uuid);
    const father = this.fatherOptions.find((p) => p.animal_uuid === this.animal?.father_animal_uuid);
    this.form.patchValue({
      motherRegistrationNumber: mother?.registration_number ?? '',
      fatherRegistrationNumber: father?.registration_number ?? ''
    }, { emitEvent: false });
  }

  private toDateInputValue(value?: string | null): string {
    if (!value) {
      return '';
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      return String(value).slice(0, 10);
    }
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
