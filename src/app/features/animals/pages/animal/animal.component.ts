import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SessionService } from 'src/app/core/services/session.service';
import { hasPermission, Permission } from 'src/app/shared/constants/permissions';
import { ApiPagination } from 'src/app/shared/models/paginated-list.model';
import { pageNumbers } from 'src/app/shared/utils/list-query.util';
import { AnimalListItem } from '../../models/animal.model';
import { AnimalService } from '../../services/animal.service';

@Component({
  selector: 'app-animal',
  templateUrl: './animal.component.html',
  styleUrls: ['./animal.component.scss']
})
export class AnimalComponent implements OnInit, OnDestroy {
  animals: AnimalListItem[] = [];
  searchTerm = '';
  selectedSex = 'ALL';
  page = 1;
  readonly pageSize = 10;
  isLoading = false;
  listPagination: ApiPagination = {
    totalItems: 0,
    totalPages: 1,
    currentPage: 1,
    order: 'DESC',
    pageSize: 10,
  };

  private readonly searchChanges$ = new Subject<string>();
  private searchSub?: Subscription;

  constructor(
    private readonly animalService: AnimalService,
    private readonly sessionService: SessionService
  ) {}

  get canAnimalWrite(): boolean {
    return hasPermission(this.sessionService.getRoles(), Permission.ANIMAL_WRITE);
  }

  ngOnInit(): void {
    this.searchSub = this.searchChanges$
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.loadAnimals());
    this.loadAnimals();
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  get totalPages(): number {
    return this.listPagination.totalPages;
  }

  get pageNumbersList(): number[] {
    return pageNumbers(this.totalPages);
  }

  updateSearch(term: string): void {
    this.searchTerm = term;
    this.page = 1;
    this.searchChanges$.next(term);
  }

  updateSexFilter(value: string): void {
    this.selectedSex = value;
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

  private loadAnimals(): void {
    this.isLoading = true;
    this.animalService
      .getAnimals({
        page: this.page,
        size: this.pageSize,
        search: this.searchTerm,
        sex: this.selectedSex,
        status: 'active',
        sortBy: 'createdAt',
        order: 'DESC',
      })
      .subscribe({
        next: (result) => {
          this.animals = result.items;
          this.listPagination = result.pagination;
          this.page = result.pagination.currentPage;
          this.isLoading = false;
        },
        error: () => {
          this.animals = [];
          this.isLoading = false;
        },
      });
  }
}
