import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { RanchFormValue } from 'src/app/shared/components/forms/ranch-form/ranch-form.component';
import { hasPermission, Permission } from 'src/app/shared/constants/permissions';
import { CompanyManagement } from '../../models/company-management.model';
import { SaasManagementService } from '../../services/saas-management.service';

@Component({
  selector: 'app-company-ranch-create',
  templateUrl: './company-ranch-create.component.html'
})
export class CompanyRanchCreateComponent implements OnInit {
  company: CompanyManagement | null = null;
  isLoading = true;
  errorMessage = '';
  ranchForm: RanchFormValue = { name: '', location: '', area: '' };
  isSaving = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly saasManagementService: SaasManagementService,
    private readonly i18nService: I18nService,
    private readonly sessionService: SessionService
  ) {}

  get canManageRanches(): boolean {
    return hasPermission(this.sessionService.getRoles(), Permission.RANCH_WRITE);
  }

  ngOnInit(): void {
    const uuidCompany = this.route.snapshot.paramMap.get('uuidCompany');
    if (!uuidCompany) {
      this.errorMessage = this.i18nService.translate('errors.loadCompanies');
      this.isLoading = false;
      return;
    }
    if (!this.canManageRanches) {
      void this.router.navigate(['/saas-management', uuidCompany]);
      return;
    }
    this.saasManagementService.getCompany(uuidCompany).subscribe({
      next: (company) => {
        this.company = company;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = this.i18nService.translate('saas.companyNotFound');
        this.isLoading = false;
      }
    });
  }

  cancel(): void {
    const id = this.company?.uuid_company ?? this.route.snapshot.paramMap.get('uuidCompany');
    if (id) {
      void this.router.navigate(['/saas-management', id]);
    } else {
      void this.router.navigateByUrl('/saas-management');
    }
  }

  save(value: RanchFormValue): void {
    const company = this.company;
    if (!company) {
      return;
    }
    this.isSaving = true;
    this.errorMessage = '';
    this.saasManagementService
      .createRanch({
        name: value.name.trim(),
        uuid_company: company.uuid_company,
        location: value.location.trim() || null,
        area: value.area.trim() || null
      })
      .subscribe({
        next: () => {
          this.isSaving = false;
          void this.router.navigate(['/saas-management', company.uuid_company]);
        },
        error: () => {
          this.isSaving = false;
          this.errorMessage = this.i18nService.translate('errors.saveRanch');
        }
      });
  }
}
