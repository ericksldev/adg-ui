import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import { RanchPageService } from 'src/app/features/ranches/services/ranch-page.service';
import { Paddock } from '../../models/paddock.model';
import { PaddockManagementService } from '../../services/paddock-management.service';
import { normalizeUserRoles } from 'src/app/shared/constants/domain.constants';

@Component({
  selector: 'app-paddock-detail',
  templateUrl: './paddock-detail.component.html',
  styleUrls: ['./paddock-detail.component.scss']
})
export class PaddockDetailComponent implements OnInit, OnDestroy {
  paddock: Paddock | null = null;
  ranchName = '';
  companyName = '';
  ranchCompanyUuid = '';
  isLoading = true;
  errorMessage = '';
  isDeleting = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly paddockManagementService: PaddockManagementService,
    private readonly userManagementService: UserManagementService,
    private readonly ranchPageService: RanchPageService,
    private readonly sessionService: SessionService,
    private readonly i18nService: I18nService
  ) {}

  get isSaasOwner(): boolean {
    return normalizeUserRoles(this.sessionService.getRoles() as string[]).includes('saas_owner');
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('uuidPaddock');
      if (!id) {
        void this.router.navigate(['/configuration/paddocks']);
        return;
      }
      this.load(id);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  listQueryParams(): Record<string, string> {
    if (!this.paddock) {
      return {};
    }
    const params: Record<string, string> = { ranch: this.paddock.ranch_uuid };
    if (this.isSaasOwner && this.ranchCompanyUuid) {
      params['company'] = this.ranchCompanyUuid;
    }
    return params;
  }

  deactivate(): void {
    if (!this.paddock || this.isDeleting) {
      return;
    }
    const confirmed = window.confirm(this.i18nService.translate('paddocks.deactivateConfirm'));
    if (!confirmed) {
      return;
    }
    this.isDeleting = true;
    this.errorMessage = '';
    this.paddockManagementService.deletePaddock(this.paddock.paddock_uuid).subscribe({
      next: () => {
        void this.router.navigate(['/configuration/paddocks'], {
          queryParams: this.listQueryParams()
        });
      },
      error: () => {
        this.isDeleting = false;
        this.errorMessage = this.i18nService.translate('errors.deletePaddock');
      }
    });
  }

  private load(paddockUuid: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.paddock = null;
    this.paddockManagementService.getPaddockById(paddockUuid).subscribe({
      next: (row) => {
        this.paddock = row;
        this.resolveRanchContext(row.ranch_uuid);
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = this.i18nService.translate('paddocks.detailNotFound');
        this.isLoading = false;
      }
    });
  }

  private resolveRanchContext(ranchUuid: string): void {
    this.ranchPageService.getRanchById(ranchUuid).subscribe({
      next: (ranch) => {
        this.ranchName = ranch.name;
        this.ranchCompanyUuid = ranch.uuid_company ?? '';
        if (this.isSaasOwner && ranch.uuid_company) {
          this.resolveCompanyName(ranch.uuid_company);
        }
      },
      error: () => {
        this.ranchName = ranchUuid;
      }
    });
  }

  private resolveCompanyName(uuidCompany: string): void {
    this.userManagementService.getCompanies().subscribe({
      next: (list) => {
        this.companyName = list.find((c) => c.uuid_company === uuidCompany)?.name ?? '';
      }
    });
  }
}
