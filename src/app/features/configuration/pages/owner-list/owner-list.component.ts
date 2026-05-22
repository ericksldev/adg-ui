import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { I18nService } from 'src/app/core/services/i18n.service';
import { ApiPagination } from 'src/app/shared/models/paginated-list.model';
import { pageNumbers } from 'src/app/shared/utils/list-query.util';
import { OwnerListItem } from '../../models/owner-list-item.model';
import { OwnerManagementService } from '../../services/owner-management.service';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.scss']
})
export class OwnerListComponent implements OnInit, OnDestroy {
  owners: OwnerListItem[] = [];
  search = '';
  page = 1;
  readonly pageSize = 10;
  listPagination: ApiPagination = {
    totalItems: 0,
    totalPages: 1,
    currentPage: 1,
    order: 'ASC',
    pageSize: 10,
  };
  isLoading = false;
  errorMessage = '';

  private readonly searchChanges$ = new Subject<string>();
  private searchSub?: Subscription;

  constructor(
    private readonly ownerManagementService: OwnerManagementService,
    private readonly i18nService: I18nService
  ) {}

  ngOnInit(): void {
    this.searchSub = this.searchChanges$
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.loadOwners());
    this.loadOwners();
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

  updateSearch(value: string): void {
    this.search = value;
    this.page = 1;
    this.searchChanges$.next(value);
  }

  goToPage(nextPage: number): void {
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.page = nextPage;
    this.loadOwners();
  }

  private loadOwners(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.ownerManagementService
      .getOwners({
        page: this.page,
        size: this.pageSize,
        search: this.search,
      })
      .subscribe({
        next: (result) => {
          this.owners = result.items;
          this.listPagination = result.pagination;
          this.page = result.pagination.currentPage;
          this.isLoading = false;
        },
        error: () => {
          this.owners = [];
          this.errorMessage = this.i18nService.translate('errors.loadOwners');
          this.isLoading = false;
        },
      });
  }
}
