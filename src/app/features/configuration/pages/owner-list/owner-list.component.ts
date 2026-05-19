import { Component, OnInit } from '@angular/core';
import { I18nService } from 'src/app/core/services/i18n.service';
import { OwnerListItem } from '../../models/owner-list-item.model';
import { OwnerManagementService } from '../../services/owner-management.service';

@Component({
  selector: 'app-owner-list',
  templateUrl: './owner-list.component.html',
  styleUrls: ['./owner-list.component.scss']
})
export class OwnerListComponent implements OnInit {
  owners: OwnerListItem[] = [];
  filteredOwners: OwnerListItem[] = [];
  search = '';
  isLoading = false;
  errorMessage = '';

  constructor(
    private readonly ownerManagementService: OwnerManagementService,
    private readonly i18nService: I18nService
  ) {}

  ngOnInit(): void {
    this.loadOwners();
  }

  updateSearch(value: string): void {
    this.search = value;
    this.applyFilter();
  }

  private loadOwners(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.ownerManagementService.getOwners().subscribe({
      next: (rows) => {
        this.owners = rows;
        this.applyFilter();
        this.isLoading = false;
      },
      error: () => {
        this.owners = [];
        this.filteredOwners = [];
        this.errorMessage = this.i18nService.translate('errors.loadOwners');
        this.isLoading = false;
      }
    });
  }

  private applyFilter(): void {
    const term = this.search.trim().toLowerCase();
    if (!term) {
      this.filteredOwners = [...this.owners];
      return;
    }
    this.filteredOwners = this.owners.filter((owner) => {
      const haystack = [
        owner.full_name,
        owner.document_number,
        owner.phone_number,
        owner.email
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }
}
