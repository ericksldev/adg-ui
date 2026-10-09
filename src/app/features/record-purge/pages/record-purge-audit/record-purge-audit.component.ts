import { Component, OnInit } from '@angular/core';
import { I18nService } from 'src/app/core/services/i18n.service';
import { ApiPagination } from 'src/app/shared/models/paginated-list.model';
import { pageNumbers } from 'src/app/shared/utils/list-query.util';
import { RecordDeletionAuditItem } from '../../models/record-purge.model';
import { RecordPurgeService } from '../../services/record-purge.service';

@Component({
  selector: 'app-record-purge-audit',
  templateUrl: './record-purge-audit.component.html',
  styleUrls: ['./record-purge-audit.component.scss']
})
export class RecordPurgeAuditComponent implements OnInit {
  page = 1;
  readonly pageSize = 10;
  isLoading = false;
  errorMessage = '';
  audits: RecordDeletionAuditItem[] = [];
  pagination: ApiPagination = {
    totalItems: 0,
    totalPages: 1,
    currentPage: 1,
    order: 'DESC',
    pageSize: 10
  };

  constructor(
    private readonly recordPurgeService: RecordPurgeService,
    private readonly i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get totalPages(): number {
    return this.pagination.totalPages || 1;
  }

  get pageNumbersList(): number[] {
    return pageNumbers(this.totalPages);
  }

  kindLabel(kind: string): string {
    return kind === 'W'
      ? this.i18n.translate('recordPurge.kind.session')
      : this.i18n.translate('recordPurge.kind.animal');
  }

  goToPage(nextPage: number): void {
    if (nextPage < 1 || nextPage > this.totalPages || nextPage === this.page) {
      return;
    }
    this.page = nextPage;
    this.load();
  }

  private load(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.recordPurgeService.listAudits({ page: this.page, size: this.pageSize }).subscribe({
      next: (result) => {
        this.audits = result.items;
        this.pagination = result.pagination;
        this.isLoading = false;
      },
      error: () => {
        this.audits = [];
        this.isLoading = false;
        this.errorMessage = this.i18n.translate('recordPurge.errorLoad');
      }
    });
  }
}
