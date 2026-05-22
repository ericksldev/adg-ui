import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { I18nService } from 'src/app/core/services/i18n.service';
import { Owner } from '../../models/owner.model';
import { OwnerManagementService } from '../../services/owner-management.service';

@Component({
  selector: 'app-owner-detail',
  templateUrl: './owner-detail.component.html',
  styleUrls: ['./owner-detail.component.scss']
})
export class OwnerDetailComponent implements OnInit, OnDestroy {
  owner: Owner | null = null;
  isLoading = true;
  errorMessage = '';
  isDeleting = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly ownerManagementService: OwnerManagementService,
    private readonly i18nService: I18nService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('uuidOwner');
      if (!id) {
        void this.router.navigate(['/configuration/owners']);
        return;
      }
      this.load(id);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  deactivate(): void {
    if (!this.owner || this.isDeleting) {
      return;
    }
    const confirmed = window.confirm(this.i18nService.translate('owners.deactivateConfirm'));
    if (!confirmed) {
      return;
    }
    this.isDeleting = true;
    this.errorMessage = '';
    this.ownerManagementService.deleteOwner(this.owner.owner_uuid).subscribe({
      next: () => {
        void this.router.navigate(['/configuration/owners']);
      },
      error: () => {
        this.isDeleting = false;
        this.errorMessage = this.i18nService.translate('errors.deleteOwner');
      }
    });
  }

  private load(ownerUuid: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.owner = null;
    this.ownerManagementService.getOwnerById(ownerUuid).subscribe({
      next: (row) => {
        this.owner = row;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = this.i18nService.translate('owners.detailNotFound');
        this.isLoading = false;
      }
    });
  }
}
