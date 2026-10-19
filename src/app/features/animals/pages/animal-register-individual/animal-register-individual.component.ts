import { Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, finalize, switchMap, takeUntil } from 'rxjs/operators';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import {
  isDuplicateRegistrationError,
  translateAnimalWriteError
} from 'src/app/core/utils/animal-write-error.util';
import { RanchOption } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import { SearchableSelectOption } from 'src/app/shared/components/searchable-select/searchable-select.component';
import { CategoryMultiSelectOption } from '../../components/category-multi-select/category-multi-select.component';
import { AnimalCreatePayload } from '../../models/animal-create-payload.model';
import { parentOptionLabel } from '../../utils/parent-option-label.util';
import { CorralWorkSessionApiService } from 'src/app/features/corral-work-sessions/services/corral-work-session-api.service';
import { LivestockCategoryApiService } from 'src/app/features/configuration/services/livestock-category-api.service';
import { LivestockCategory } from 'src/app/features/configuration/models/livestock-category.model';
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
  loadingRanchDependencies = false;
  fromPendingRegistration = false;
  private pendingRowUuid = '';

  ranchRows: RanchOption[] = [];
  breedRows: BreedOptionDto[] = [];
  ownerRows: OwnerOptionDto[] = [];
  paddockOptions: PaddockOptionDto[] = [];
  motherOptions: ParentOptionDto[] = [];
  fatherOptions: ParentOptionDto[] = [];
  categoryOptions: LivestockCategory[] = [];
  selectedCategoryIds = new Set<string>();

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly i18n: I18nService,
    private readonly sessionService: SessionService,
    private readonly userManagementService: UserManagementService,
    private readonly animalApi: AnimalApiService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly livestockCategoryApi: LivestockCategoryApiService,
    private readonly corralApi: CorralWorkSessionApiService
  ) {
    this.form = this.fb.group({
      ranchUuid: ['', Validators.required],
      registrationNumber: ['', Validators.required],
      chipNumber: [''],
      breedCode: [''],
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
    const pendingRanch = String(this.route.snapshot.queryParamMap.get('ranchUuid') ?? '').trim();
    const pendingNumber = String(this.route.snapshot.queryParamMap.get('registrationNumber') ?? '').trim();
    this.fromPendingRegistration = this.route.snapshot.queryParamMap.get('fromPending') === '1';
    this.pendingRowUuid = String(this.route.snapshot.queryParamMap.get('pendingRowUuid') ?? '').trim();

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

    this.livestockCategoryApi.listCategories(false).pipe(takeUntil(this.destroy$)).subscribe({
      next: (categories) => {
        this.categoryOptions = categories;
      },
      error: () => {
        this.categoryOptions = [];
      }
    });

    this.form
      .get('ranchUuid')
      ?.valueChanges.pipe(
        takeUntil(this.destroy$),
        switchMap((ranchUuid) => {
          const id = String(ranchUuid ?? '').trim();
          if (!id) {
            this.loadingRanchDependencies = false;
            return of({ paddocks: [] as PaddockOptionDto[], mothers: [] as ParentOptionDto[], fathers: [] as ParentOptionDto[] });
          }
          this.loadingRanchDependencies = true;
          return forkJoin({
            paddocks: this.animalApi.getPaddocksForRanch(id).pipe(catchError(() => of([]))),
            mothers: this.animalApi.getParentOptions(id, 'FEMALE').pipe(catchError(() => of([]))),
            fathers: this.animalApi.getParentOptions(id, 'MALE').pipe(catchError(() => of([])))
          }).pipe(finalize(() => {
            this.loadingRanchDependencies = false;
          }));
        })
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

    if (pendingRanch || pendingNumber) {
      this.form.patchValue({
        ranchUuid: pendingRanch,
        registrationNumber: pendingNumber
      });
    }
  }

  get ranchSelected(): boolean {
    return Boolean(String(this.form.get('ranchUuid')?.value ?? '').trim());
  }

  get paddockSelectOptions(): SearchableSelectOption[] {
    return this.paddockOptions.map((p) => ({ value: p.paddock_uuid, label: p.name }));
  }

  get motherSelectOptions(): SearchableSelectOption[] {
    return this.motherOptions.map((p) => ({
      value: p.animal_uuid,
      label: parentOptionLabel(p, this.motherOptions)
    }));
  }

  get fatherSelectOptions(): SearchableSelectOption[] {
    return this.fatherOptions.map((p) => ({
      value: p.animal_uuid,
      label: parentOptionLabel(p, this.fatherOptions)
    }));
  }

  get currentPaddockUuid(): string {
    return String(this.form.get('currentPaddockUuid')?.value ?? '');
  }

  get motherRegistrationNumber(): string {
    return String(this.form.get('motherRegistrationNumber')?.value ?? '');
  }

  get fatherRegistrationNumber(): string {
    return String(this.form.get('fatherRegistrationNumber')?.value ?? '');
  }

  onPaddockChange(value: string): void {
    this.form.get('currentPaddockUuid')?.setValue(value);
  }

  onMotherChange(value: string): void {
    this.form.get('motherRegistrationNumber')?.setValue(value);
  }

  onFatherChange(value: string): void {
    this.form.get('fatherRegistrationNumber')?.setValue(value);
  }

  isMotherUnknown(): boolean {
    return this.parentLinkState('mother') === 'unknown';
  }

  isFatherUnknown(): boolean {
    return this.parentLinkState('father') === 'unknown';
  }

  isMotherAmbiguous(): boolean {
    return this.parentLinkState('mother') === 'ambiguous';
  }

  isFatherAmbiguous(): boolean {
    return this.parentLinkState('father') === 'ambiguous';
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

  get categorySelectOptions(): CategoryMultiSelectOption[] {
    return this.categoryOptions.map((category) => ({ value: category.category_uuid, label: category.name }));
  }

  get selectedCategoryIdList(): string[] {
    return [...this.selectedCategoryIds];
  }

  onCategoriesChange(ids: string[]): void {
    this.selectedCategoryIds = new Set(ids);
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
      registration_number: v.registrationNumber.trim(),
      sex: v.sex as 'MALE' | 'FEMALE',
      origin_type: v.originType as AnimalCreatePayload['origin_type'],
      birth_date: String(v.birthDate ?? '').trim()
    };

    const breed = String(v.breedCode ?? '').trim();
    if (breed) {
      payload.breed_code = breed;
    }

    const chip = String(v.chipNumber ?? '').trim();
    const mother = String(v.motherRegistrationNumber ?? '').trim();
    const father = String(v.fatherRegistrationNumber ?? '').trim();
    if (this.isMotherAmbiguous() || this.isFatherAmbiguous()) {
      this.feedback = {
        type: 'error',
        message: this.i18n.translate(this.isMotherAmbiguous() ? 'animal.errorMotherAmbiguous' : 'animal.errorFatherAmbiguous')
      };
      return;
    }
    const owner = String(v.currentOwnerUuid ?? '').trim();
    const paddock = String(v.currentPaddockUuid ?? '').trim();
    const color = String(v.color ?? '').trim();
    const desc = String(v.description ?? '').trim();

    if (chip) {
      payload.chip_number = chip;
    }
    this.assignParentPayload(payload, 'mother', mother);
    this.assignParentPayload(payload, 'father', father);
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

    const hadUnresolvedParents = this.isMotherUnknown() || this.isFatherUnknown();

    this.saving = true;
    this.animalApi.createAnimal(payload).subscribe({
      next: (created) => {
        const animalUuid = (created as { animal_uuid?: string } | null)?.animal_uuid;
        const categoryIds = [...this.selectedCategoryIds];
        if (!animalUuid || categoryIds.length === 0) {
          this.finishCreate(hadUnresolvedParents);
          return;
        }
        forkJoin(categoryIds.map((id) => this.livestockCategoryApi.assign(animalUuid, id, null))).subscribe({
          next: () => this.finishCreate(hadUnresolvedParents),
          error: () => {
            this.saving = false;
            this.feedback = { type: 'error', message: this.i18n.translate('livestockCategory.loadError') };
          }
        });
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

  private parentLinkState(role: 'mother' | 'father'): 'empty' | 'linked' | 'unknown' | 'ambiguous' {
    const control = role === 'mother' ? 'motherRegistrationNumber' : 'fatherRegistrationNumber';
    const options = role === 'mother' ? this.motherOptions : this.fatherOptions;
    const value = String(this.form.get(control)?.value ?? '').trim();
    if (!value || !this.ranchSelected) {
      return 'empty';
    }
    if (options.some((option) => option.animal_uuid === value)) {
      return 'linked';
    }
    const matches = options.filter(
      (option) => option.registration_number.trim().toLowerCase() === value.toLowerCase()
    );
    if (matches.length === 1) {
      return 'linked';
    }
    if (matches.length > 1) {
      return 'ambiguous';
    }
    return 'unknown';
  }

  private assignParentPayload(payload: AnimalCreatePayload, role: 'mother' | 'father', value: string): void {
    if (!value) {
      return;
    }
    const options = role === 'mother' ? this.motherOptions : this.fatherOptions;
    const byUuid = options.find((option) => option.animal_uuid === value);
    const byNumber = options.filter(
      (option) => option.registration_number.trim().toLowerCase() === value.toLowerCase()
    );
    const animalUuid = byUuid?.animal_uuid ?? (byNumber.length === 1 ? byNumber[0].animal_uuid : '');
    if (animalUuid) {
      if (role === 'mother') {
        payload.mother_animal_uuid = animalUuid;
      } else {
        payload.father_animal_uuid = animalUuid;
      }
      return;
    }
    if (role === 'mother') {
      payload.mother_registration_number = value;
    } else {
      payload.father_registration_number = value;
    }
  }

  private finishCreate(hadUnresolvedParents: boolean): void {
    this.saving = false;
    if (this.fromPendingRegistration) {
      const goBack = () => {
        void this.router.navigate(['/corral-work-session/pending-registrations']);
      };
      if (!this.pendingRowUuid) {
        goBack();
        return;
      }
      this.corralApi.resolvePendingRegistrations([this.pendingRowUuid]).subscribe({
        next: goBack,
        error: goBack
      });
      return;
    }
    let message = this.i18n.translate('animal.individualSaveSuccess');
    if (hadUnresolvedParents) {
      message = `${message} ${this.i18n.translate('animal.parentNotLinkedOnSave')}`;
    }
    this.feedback = { type: 'success', message };
    this.resetForm();
  }

  private resetForm(): void {
    this.paddockOptions = [];
    this.motherOptions = [];
    this.fatherOptions = [];
    this.selectedCategoryIds = new Set();
    this.form.reset({
      ranchUuid: '',
      registrationNumber: '',
      chipNumber: '',
      breedCode: '',
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
