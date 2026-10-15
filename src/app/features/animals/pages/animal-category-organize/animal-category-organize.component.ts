import { Component, OnDestroy, OnInit } from '@angular/core';
import { forkJoin, of, Subject, Subscription } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { LivestockCategory } from 'src/app/features/configuration/models/livestock-category.model';
import { LivestockCategoryApiService } from 'src/app/features/configuration/services/livestock-category-api.service';
import { RanchOption } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import { hasPermission, Permission } from 'src/app/shared/constants/permissions';
import { CategoryMultiSelectOption } from '../../components/category-multi-select/category-multi-select.component';
import { AnimalListItem } from '../../models/animal.model';
import { AnimalService } from '../../services/animal.service';

@Component({
  selector: 'app-animal-category-organize',
  templateUrl: './animal-category-organize.component.html',
  styleUrls: ['./animal-category-organize.component.scss']
})
export class AnimalCategoryOrganizeComponent implements OnInit, OnDestroy {
  animals: AnimalListItem[] = [];
  categoryOptions: LivestockCategory[] = [];
  ranchOptions: RanchOption[] = [];
  searchTerm = '';
  selectedRanch = '';
  selectedCategory = '';
  actionCategoryIds: string[] = [];
  selectedAnimalIds = new Set<string>();
  page = 1;
  readonly pageSize = 25;
  totalPages = 1;
  totalItems = 0;
  isLoading = false;
  saving = false;
  feedback: { type: 'success' | 'error'; message: string } | null = null;

  private readonly searchChanges$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private searchSub?: Subscription;

  constructor(
    private readonly animalService: AnimalService,
    private readonly livestockCategoryApi: LivestockCategoryApiService,
    private readonly userManagementService: UserManagementService,
    private readonly sessionService: SessionService,
    private readonly i18n: I18nService
  ) {}

  get canAnimalWrite(): boolean {
    return hasPermission(this.sessionService.getRoles(), Permission.ANIMAL_WRITE);
  }

  get categorySelectOptions(): CategoryMultiSelectOption[] {
    return this.categoryOptions.map((category) => ({ value: category.category_uuid, label: category.name }));
  }

  get allPageSelected(): boolean {
    return this.animals.length > 0 && this.animals.every((animal) => this.selectedAnimalIds.has(animal.animal_uuid));
  }

  ngOnInit(): void {
    const company = this.sessionService.getUuidCompany();
    forkJoin({
      ranches: this.userManagementService.getRanches(company ?? undefined).pipe(catchError(() => of([] as RanchOption[]))),
      categories: this.livestockCategoryApi.listCategories(false).pipe(catchError(() => of([] as LivestockCategory[])))
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ ranches, categories }) => {
        this.ranchOptions = [...ranches].sort((a, b) => a.name.localeCompare(b.name));
        this.categoryOptions = [...categories].sort((a, b) => a.name.localeCompare(b.name));
      });

    this.searchSub = this.searchChanges$
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.page = 1;
        this.loadAnimals();
      });
    this.loadAnimals();
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  updateSearch(value: string): void {
    this.searchTerm = value;
    this.searchChanges$.next(value);
  }

  updateRanch(value: string): void {
    this.selectedRanch = value;
    this.page = 1;
    this.loadAnimals();
  }

  updateCategory(value: string): void {
    this.selectedCategory = value;
    this.page = 1;
    this.loadAnimals();
  }

  goToPage(nextPage: number): void {
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.page = nextPage;
    this.loadAnimals();
  }

  isAnimalSelected(animalUuid: string): boolean {
    return this.selectedAnimalIds.has(animalUuid);
  }

  toggleAnimal(animalUuid: string, checked: boolean): void {
    if (checked) {
      this.selectedAnimalIds.add(animalUuid);
    } else {
      this.selectedAnimalIds.delete(animalUuid);
    }
  }

  togglePage(checked: boolean): void {
    for (const animal of this.animals) {
      this.toggleAnimal(animal.animal_uuid, checked);
    }
  }

  categoryNames(animal: AnimalListItem): string {
    return (animal.categories ?? []).map((category) => category.name).filter(Boolean).join(', ');
  }

  applyCategories(mode: 'assign' | 'remove'): void {
    const animalIds = [...this.selectedAnimalIds];
    if (!animalIds.length || !this.actionCategoryIds.length || this.saving) {
      return;
    }
    const calls = animalIds.flatMap((animalUuid) =>
      this.actionCategoryIds.map((categoryUuid) =>
        mode === 'assign'
          ? this.livestockCategoryApi.assign(animalUuid, categoryUuid, null)
          : this.livestockCategoryApi.remove(animalUuid, categoryUuid, null)
      )
    );
    this.saving = true;
    this.feedback = null;
    forkJoin(calls).subscribe({
      next: () => {
        this.saving = false;
        this.selectedAnimalIds = new Set();
        this.feedback = {
          type: 'success',
          message: this.i18n.translate(mode === 'assign' ? 'livestockCategory.organizeAssigned' : 'livestockCategory.organizeRemoved', {
            count: String(animalIds.length)
          })
        };
        this.loadAnimals();
      },
      error: () => {
        this.saving = false;
        this.feedback = { type: 'error', message: this.i18n.translate('livestockCategory.loadError') };
        this.loadAnimals();
      }
    });
  }

  private loadAnimals(): void {
    this.isLoading = true;
    this.animalService
      .getAnimals({
        page: this.page,
        size: this.pageSize,
        search: this.searchTerm,
        ranch_uuid: this.selectedRanch || undefined,
        category_uuid: this.selectedCategory || undefined,
        status: 'active',
        sortBy: 'registrationNumber',
        order: 'ASC'
      })
      .subscribe({
        next: (result) => {
          this.animals = result.items;
          this.page = result.pagination.currentPage;
          this.totalPages = result.pagination.totalPages || 1;
          this.totalItems = result.pagination.totalItems;
          this.isLoading = false;
        },
        error: () => {
          this.animals = [];
          this.isLoading = false;
          this.feedback = { type: 'error', message: this.i18n.translate('livestockCategory.loadError') };
        }
      });
  }
}
