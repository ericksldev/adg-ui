import { Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, filter, switchMap, takeUntil } from 'rxjs/operators';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import {
  isDuplicateRegistrationError,
  translateAnimalWriteError
} from 'src/app/core/utils/animal-write-error.util';
import { RanchOption } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import { AnimalCreatePayload } from '../../models/animal-create-payload.model';
import {
  AnimalApiService,
  BreedOptionDto,
  OwnerOptionDto,
  PaddockOptionDto,
  ParentOptionDto
} from '../../services/animal-api.service';

@Component({
  selector: 'app-animal-register-individual',
  templateUrl: './animal-register-individual.component.html',
  styleUrls: ['./animal-register-individual.component.scss']
})
export class AnimalRegisterIndividualComponent implements OnInit, OnDestroy {
  readonly form: FormGroup;
  readonly minBirthDate = '1900-01-01';
  readonly maxBirthDate = `${new Date().getFullYear() + 1}-12-31`;
  feedback: { type: 'success' | 'error'; message: string } | null = null;
  saving = false;

  ranchRows: RanchOption[] = [];
  breedRows: BreedOptionDto[] = [];
  ownerRows: OwnerOptionDto[] = [];
  paddockOptions: PaddockOptionDto[] = [];
  motherOptions: ParentOptionDto[] = [];
  fatherOptions: ParentOptionDto[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly i18n: I18nService,
    private readonly sessionService: SessionService,
    private readonly userManagementService: UserManagementService,
    private readonly animalApi: AnimalApiService
  ) {
    this.form = this.fb.group({
      ranchUuid: ['', Validators.required],
      registrationNumber: ['', Validators.required],
      chipNumber: [''],
      breedCode: ['UNKNOWN', Validators.required],
      sex: ['MALE', Validators.required],
      originType: ['UNKNOWN', Validators.required],
      motherRegistrationNumber: [''],
      fatherRegistrationNumber: [''],
      currentOwnerUuid: [''],
      currentPaddockUuid: [''],
      color: [''],
      birthDate: ['', [Validators.required, AnimalRegisterIndividualComponent.birthDateValidator]],
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
    const company = this.sessionService.getUuidCompany();
    forkJoin({
      ranches: this.userManagementService.getRanches(company ?? undefined).pipe(catchError(() => of([]))),
      breeds: this.animalApi.getBreeds().pipe(catchError(() => of([]))),
      owners: this.animalApi.getOwners().pipe(catchError(() => of([])))
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ ranches, breeds, owners }) => {
        this.ranchRows = ranches;
        this.breedRows = breeds;
        this.ownerRows = owners;
      });

    this.form
      .get('ranchUuid')
      ?.valueChanges.pipe(
        takeUntil(this.destroy$),
        filter((v) => Boolean(String(v ?? '').trim())),
        switchMap((ranchUuid) =>
          forkJoin({
            paddocks: this.animalApi.getPaddocksForRanch(ranchUuid).pipe(catchError(() => of([]))),
            mothers: this.animalApi.getParentOptions(ranchUuid, 'FEMALE').pipe(catchError(() => of([]))),
            fathers: this.animalApi.getParentOptions(ranchUuid, 'MALE').pipe(catchError(() => of([])))
          })
        )
      )
      .subscribe(({ paddocks, mothers, fathers }) => {
        this.paddockOptions = paddocks;
        this.motherOptions = mothers;
        this.fatherOptions = fathers;
        this.form.patchValue(
          {
            currentPaddockUuid: '',
            motherRegistrationNumber: '',
            fatherRegistrationNumber: ''
          },
          { emitEvent: false }
        );
      });

    this.form
      .get('registrationNumber')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.clearRegistrationDuplicateError());
  }

  private clearRegistrationDuplicateError(): void {
    const ctrl = this.form.get('registrationNumber');
    if (!ctrl?.hasError('duplicate')) {
      return;
    }
    const { duplicate: _duplicate, ...rest } = ctrl.errors ?? {};
    ctrl.setErrors(Object.keys(rest).length ? rest : null);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  breedLabel(code: string): string {
    return this.i18n.translate(`animal.breed.${code}`);
  }

  submit(): void {
    this.feedback = null;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.feedback = { type: 'error', message: this.i18n.translate('animal.individualInvalid') };
      return;
    }

    const v = this.form.getRawValue() as {
      ranchUuid: string;
      registrationNumber: string;
      chipNumber: string;
      breedCode: string;
      sex: string;
      originType: string;
      motherRegistrationNumber: string;
      fatherRegistrationNumber: string;
      currentOwnerUuid: string;
      currentPaddockUuid: string;
      color: string;
      birthDate: string;
      description: string;
    };
    const payload: AnimalCreatePayload = {
      ranch_uuid: v.ranchUuid.trim(),
      breed_code: v.breedCode.trim(),
      registration_number: v.registrationNumber.trim(),
      sex: v.sex as 'MALE' | 'FEMALE',
      origin_type: v.originType as AnimalCreatePayload['origin_type'],
      birth_date: String(v.birthDate ?? '').trim()
    };

    const chip = String(v.chipNumber ?? '').trim();
    const mother = String(v.motherRegistrationNumber ?? '').trim();
    const father = String(v.fatherRegistrationNumber ?? '').trim();
    const owner = String(v.currentOwnerUuid ?? '').trim();
    const paddock = String(v.currentPaddockUuid ?? '').trim();
    const color = String(v.color ?? '').trim();
    const desc = String(v.description ?? '').trim();

    if (chip) {
      payload.chip_number = chip;
    }
    if (mother) {
      payload.mother_registration_number = mother;
    }
    if (father) {
      payload.father_registration_number = father;
    }
    if (owner) {
      payload.current_owner_uuid = owner;
    }
    if (paddock) {
      payload.current_paddock_uuid = paddock;
    }
    if (color) {
      payload.color = color;
    }
    if (desc) {
      payload.description = desc;
    }

    this.saving = true;
    this.animalApi.createAnimal(payload).subscribe({
      next: () => {
        this.saving = false;
        this.feedback = { type: 'success', message: this.i18n.translate('animal.individualSaveSuccess') };
        this.resetForm();
      },
      error: (err) => {
        this.saving = false;
        const msg = translateAnimalWriteError(this.i18n, err, 'animal.individualSaveError');
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

  private resetForm(): void {
    this.paddockOptions = [];
    this.motherOptions = [];
    this.fatherOptions = [];
    this.form.reset({
      ranchUuid: '',
      registrationNumber: '',
      chipNumber: '',
      breedCode: 'UNKNOWN',
      sex: 'MALE',
      originType: 'UNKNOWN',
      motherRegistrationNumber: '',
      fatherRegistrationNumber: '',
      currentOwnerUuid: '',
      currentPaddockUuid: '',
      color: '',
      birthDate: '',
      description: ''
    });
  }
}
