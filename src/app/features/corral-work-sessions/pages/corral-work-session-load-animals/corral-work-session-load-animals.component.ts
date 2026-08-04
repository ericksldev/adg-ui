import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { translateApiError } from 'src/app/core/utils/api-error.util';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { AnimalListItem } from 'src/app/features/animals/models/animal.model';
import { AnimalApiService, PaddockOptionDto } from 'src/app/features/animals/services/animal-api.service';
import { AnimalService } from 'src/app/features/animals/services/animal.service';
import { RanchOption } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import { CORRAL_PRELOADED_WORK_MODES } from '../../constants/corral-activities';
import {
  CorralSessionAnimalsLoadBody,
  CorralSessionAnimalsPreviewDto,
  CorralSessionSourceFilter,
  CorralSessionStepDto,
  CorralWorkSessionDto
} from '../../models/corral-work-session.model';
import { CorralWorkSessionApiService } from '../../services/corral-work-session-api.service';

type LoadTab = 'paddocks' | 'filters' | 'manual';

@Component({
  selector: 'app-corral-work-session-load-animals',
  templateUrl: './corral-work-session-load-animals.component.html'
})
export class CorralWorkSessionLoadAnimalsComponent implements OnInit {
  sessionUuid = '';
  session: CorralWorkSessionDto | null = null;
  ranchName = '';

  loading = true;
  previewing = false;
  saving = false;
  errorMessage = '';
  successMessage = '';

  activeTab: LoadTab = 'paddocks';
  paddockRows: PaddockOptionDto[] = [];
  selectedPaddockUuids = new Set<string>();

  filterMale = false;
  filterFemale = false;
  filterBreedCode = '';
  filterOriginType = '';

  inventorySearch = '';
  inventoryLoading = false;
  inventoryAnimals: AnimalListItem[] = [];
  selectedManualUuids = new Set<string>();

  preview: CorralSessionAnimalsPreviewDto | null = null;
  stepAnimalAssignments = new Map<string, Set<string>>();

  readonly originTypes = ['BIRTH', 'PURCHASE', 'TRANSFER', 'UNKNOWN'] as const;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly api: CorralWorkSessionApiService,
    private readonly animalApiService: AnimalApiService,
    private readonly animalService: AnimalService,
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
    void this.router.navigate(['/corral-work-session', this.sessionUuid, 'setup'], { replaceUrl: true });
  }

  get canEditSources(): boolean {
    return this.session?.status === 'DRAFT';
  }

  get sessionSteps(): CorralSessionStepDto[] {
    return [...(this.session?.steps ?? [])]
      .filter((step) => CORRAL_PRELOADED_WORK_MODES.includes(step.work_mode ?? 'PRELOADED_SEARCH'))
      .sort((a, b) => a.step_order - b.step_order);
  }

  get hasAnySource(): boolean {
    return (
      this.selectedPaddockUuids.size > 0 ||
      this.filterMale ||
      this.filterFemale ||
      Boolean(this.filterBreedCode.trim()) ||
      Boolean(this.filterOriginType) ||
      this.selectedManualUuids.size > 0
    );
  }

  loadSession(): void {
    this.loading = true;
    this.errorMessage = '';
    this.api
      .getSession(this.sessionUuid)
      .pipe(
        catchError(() => {
          this.errorMessage = this.i18n.translate('corralWorkSession.errorLoadSession');
          return of(null);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((session) => {
        if (!session) return;
        this.session = session;
        if (session.status === 'CLOSED') {
          void this.router.navigate(['/corral-work-session']);
          return;
        }
        if (!session.work_configured) {
          void this.router.navigate(['/corral-work-session', this.sessionUuid, 'setup']);
          return;
        }
        if (!session.requires_animal_load) {
          void this.router.navigate(['/corral-work-session', this.sessionUuid, 'work']);
          return;
        }
        this.loadRanchName(session.ranch_uuid);
        this.loadPaddocks(session.ranch_uuid);
        if (session.status !== 'DRAFT') {
          this.loadInventory();
        }
      });
  }

  private loadRanchName(ranchUuid: string): void {
    const company = this.sessionService.getUuidCompany() ?? undefined;
    this.userManagementService.getRanches(company).subscribe({
      next: (ranches: RanchOption[]) => {
        this.ranchName = ranches.find((r) => r.uuid_ranch === ranchUuid)?.name ?? ranchUuid;
      }
    });
  }

  private loadPaddocks(ranchUuid: string): void {
    this.animalApiService.getPaddocksForRanch(ranchUuid).subscribe({
      next: (paddocks) => {
        this.paddockRows = paddocks;
      }
    });
  }

  setTab(tab: LoadTab): void {
    this.activeTab = tab;
    if (tab === 'manual' && this.inventoryAnimals.length === 0) {
      this.loadInventory();
    }
  }

  togglePaddock(uuid: string, checked: boolean): void {
    if (checked) {
      this.selectedPaddockUuids.add(uuid);
    } else {
      this.selectedPaddockUuids.delete(uuid);
    }
    this.resetPreview();
  }

  isPaddockSelected(uuid: string): boolean {
    return this.selectedPaddockUuids.has(uuid);
  }

  onFilterChange(): void {
    this.resetPreview();
  }

  private resetPreview(): void {
    this.preview = null;
    this.stepAnimalAssignments.clear();
  }

  loadInventory(): void {
    this.inventoryLoading = true;
    this.animalService
      .getAnimals({
        page: 1,
        size: 200,
        search: this.inventorySearch.trim() || undefined,
        sex: 'ALL',
        status: 'active',
        sortBy: 'registration_number',
        order: 'ASC'
      })
      .pipe(
        finalize(() => {
          this.inventoryLoading = false;
        })
      )
      .subscribe({
        next: (result) => {
          const ranchUuid = this.session?.ranch_uuid;
          this.inventoryAnimals = ranchUuid
            ? result.items.filter((a) => a.ranch_uuid === ranchUuid || !a.ranch_uuid)
            : result.items;
        },
        error: () => {
          this.inventoryAnimals = [];
        }
      });
  }

  toggleManual(uuid: string, checked: boolean): void {
    if (checked) {
      this.selectedManualUuids.add(uuid);
    } else {
      this.selectedManualUuids.delete(uuid);
    }
    this.resetPreview();
  }

  isManualSelected(uuid: string): boolean {
    return this.selectedManualUuids.has(uuid);
  }

  originLabel(value: string): string {
    const keyMap: Record<string, string> = {
      BIRTH: 'animal.originBirth',
      PURCHASE: 'animal.originPurchase',
      TRANSFER: 'animal.originTransfer',
      UNKNOWN: 'animal.originUnknown'
    };
    const key = keyMap[value];
    return key ? this.i18n.translate(key) : value;
  }

  isAnimalInStep(stepUuid: string, animalUuid: string): boolean {
    return this.stepAnimalAssignments.get(stepUuid)?.has(animalUuid) ?? false;
  }

  toggleStepAnimal(stepUuid: string, animalUuid: string, checked: boolean): void {
    let assigned = this.stepAnimalAssignments.get(stepUuid);
    if (!assigned) {
      assigned = new Set<string>();
      this.stepAnimalAssignments.set(stepUuid, assigned);
    }
    if (checked) {
      assigned.add(animalUuid);
    } else {
      assigned.delete(animalUuid);
    }
  }

  stepAssignmentCount(stepUuid: string): number {
    return this.stepAnimalAssignments.get(stepUuid)?.size ?? 0;
  }

  private initStepAssignments(): void {
    this.stepAnimalAssignments.clear();
    const steps = this.sessionSteps;
    if (!this.preview || steps.length === 0) return;

    for (const step of steps) {
      this.stepAnimalAssignments.set(step.uuid_corral_session_step, new Set());
    }

    const defaultStepUuid =
      steps.length === 1 ? steps[0].uuid_corral_session_step : steps[0].uuid_corral_session_step;
    const defaultSet = this.stepAnimalAssignments.get(defaultStepUuid);
    if (!defaultSet) return;

    for (const animal of this.preview.animals) {
      defaultSet.add(animal.animal_uuid);
    }
  }

  private validateStepAssignments(): boolean {
    if (!this.preview) return false;
    const assigned = new Set<string>();
    for (const animalSet of this.stepAnimalAssignments.values()) {
      for (const animalUuid of animalSet) {
        assigned.add(animalUuid);
      }
    }
    for (const animal of this.preview.animals) {
      if (!assigned.has(animal.animal_uuid)) {
        this.errorMessage = this.i18n.translate('corralWorkSession.errorUnassignedAnimals');
        return false;
      }
    }
    return true;
  }

  buildSourceBody(): Pick<CorralSessionAnimalsLoadBody, 'source_paddock_uuids' | 'source_filters' | 'manual_animal_uuids'> {
    const source_filters: CorralSessionSourceFilter[] = [];
    if (this.filterMale) {
      source_filters.push({ filter_key: 'sex', filter_value: 'MALE' });
    }
    if (this.filterFemale) {
      source_filters.push({ filter_key: 'sex', filter_value: 'FEMALE' });
    }
    if (this.filterBreedCode.trim()) {
      source_filters.push({ filter_key: 'breed_code', filter_value: this.filterBreedCode.trim() });
    }
    if (this.filterOriginType) {
      source_filters.push({ filter_key: 'origin_type', filter_value: this.filterOriginType });
    }
    return {
      source_paddock_uuids: [...this.selectedPaddockUuids],
      source_filters,
      manual_animal_uuids: [...this.selectedManualUuids]
    };
  }

  buildLoadBody(): CorralSessionAnimalsLoadBody {
    const step_assignments = this.sessionSteps.map((step) => ({
      uuid_corral_session_step: step.uuid_corral_session_step,
      animal_uuids: [...(this.stepAnimalAssignments.get(step.uuid_corral_session_step) ?? new Set<string>())]
    }));

    return {
      ...this.buildSourceBody(),
      step_assignments
    };
  }

  previewAnimals(): void {
    this.errorMessage = '';
    this.successMessage = '';
    if (!this.hasAnySource) {
      this.errorMessage = this.i18n.translate('corralWorkSession.errorNoSources');
      return;
    }
    this.previewing = true;
    const previewBody = this.buildSourceBody();
    this.api
      .previewAnimals(this.sessionUuid, previewBody)
      .pipe(
        catchError((err) => {
          this.errorMessage =
            translateApiError(this.i18n, err, 'corralWorkSession.errorPreview');
          return of(null);
        }),
        finalize(() => {
          this.previewing = false;
        })
      )
      .subscribe((preview) => {
        this.preview = preview;
        if (preview && preview.total_count === 0) {
          this.errorMessage = this.i18n.translate('corralWorkSession.errorNoAnimalsMatched');
          return;
        }
        if (preview) {
          this.initStepAssignments();
        }
      });
  }

  confirmLoad(): void {
    this.errorMessage = '';
    this.successMessage = '';
    if (!this.hasAnySource) {
      this.errorMessage = this.i18n.translate('corralWorkSession.errorNoSources');
      return;
    }
    if (!this.preview) {
      this.errorMessage = this.i18n.translate('corralWorkSession.errorPreviewRequired');
      return;
    }
    if (!this.validateStepAssignments()) {
      return;
    }
    this.saving = true;
    this.api
      .loadAnimals(this.sessionUuid, this.buildLoadBody())
      .pipe(
        catchError((err) => {
          this.errorMessage =
            translateApiError(this.i18n, err, 'corralWorkSession.errorLoadAnimals');
          return of(null);
        }),
        finalize(() => {
          this.saving = false;
        })
      )
      .subscribe((result) => {
        if (!result) return;
        void this.router.navigate(['/corral-work-session', this.sessionUuid, 'work']);
      });
  }

  backToList(): void {
    void this.router.navigate(['/corral-work-session']);
  }
}
