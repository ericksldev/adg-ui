import { Component, OnInit } from '@angular/core';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { hasPermission, Permission } from 'src/app/shared/constants/permissions';
import { LivestockCategory } from '../../models/livestock-category.model';
import { LivestockCategoryApiService } from '../../services/livestock-category-api.service';

@Component({
  selector: 'app-livestock-category-admin',
  templateUrl: './livestock-category-admin.component.html',
  styleUrls: ['./livestock-category-admin.component.scss']
})
export class LivestockCategoryAdminComponent implements OnInit {
  categories: LivestockCategory[] = [];
  isLoading = true;
  errorMessage = '';
  categoryForm = { name: '', description: '', category_type: 'CUSTOM' };

  constructor(
    private readonly api: LivestockCategoryApiService,
    private readonly sessionService: SessionService,
    private readonly i18nService: I18nService
  ) {}

  get canWrite(): boolean {
    return hasPermission(this.sessionService.getRoles(), Permission.LIVESTOCK_CATEGORY_WRITE);
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.api.listCategories(true).subscribe({
      next: (categories) => {
        this.categories = categories;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = this.i18nService.translate('livestockCategory.loadError');
      }
    });
  }

  createCategory(): void {
    this.api.createCategory({
      name: this.categoryForm.name,
      description: this.categoryForm.description || null,
      category_type: this.categoryForm.category_type
    }).subscribe({
      next: () => {
        this.categoryForm = { name: '', description: '', category_type: 'CUSTOM' };
        this.reload();
      },
      error: (error) => {
        this.errorMessage = error?.error?.description || error?.error?.error || this.i18nService.translate('livestockCategory.loadError');
      }
    });
  }

  deactivateCategory(category: LivestockCategory): void {
    this.api.deactivateCategory(category.category_uuid).subscribe({
      next: () => this.reload(),
      error: (error) => {
        this.errorMessage = error?.error?.description || error?.error?.error || this.i18nService.translate('livestockCategory.loadError');
      }
    });
  }
}
