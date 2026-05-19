import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SessionService } from 'src/app/core/services/session.service';
import { translateUserWriteError } from 'src/app/core/utils/user-write-error.util';
import { normalizeUserRole, normalizeUserRoles, UserRole } from 'src/app/shared/constants/domain.constants';
import { UserFormValue } from 'src/app/shared/components/forms/user-form/user-form.component';
import { SearchableSelectOption } from 'src/app/shared/components/searchable-select/searchable-select.component';
import { I18nService } from 'src/app/core/services/i18n.service';
import { CompanyOption, RanchOption, UserManagementItem, UserManagementPayload } from '../../models/user-management.model';
import { UserManagementService } from '../../services/user-management.service';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit {
  readonly normalizeUserRole = normalizeUserRole;

  users: UserManagementItem[] = [];
  companies: CompanyOption[] = [];
  ranches: RanchOption[] = [];
  selectedCompany = '';
  selectedRanch = '';
  userSearch = '';
  isLoading = false;
  errorMessage = '';
  editUser: UserManagementItem | null = null;
  formValue: UserFormValue = this.buildEmptyForm();

  get assignableRoles(): UserRole[] {
    if (this.isSaasOwner) {
      return ['administrator', 'ranch_staff'];
    }
    if (this.sessionRoles.includes('administrator')) {
      return ['ranch_staff'];
    }
    return ['ranch_staff'];
  }

  constructor(
    private readonly route: ActivatedRoute,
    private readonly userManagementService: UserManagementService,
    private readonly sessionService: SessionService,
    private readonly i18nService: I18nService
  ) {}

  ngOnInit(): void {
    if (this.isSaasOwner) {
      this.loadCompanies();
      return;
    }

    this.loadRanchAndUsers();
  }

  get sessionRoles(): UserRole[] {
    return normalizeUserRoles(this.sessionService.getRoles() as string[]);
  }

  get isSaasOwner(): boolean {
    return this.sessionRoles.includes('saas_owner');
  }

  /** Tenant admins may assign company roles (aligned with MEMBERSHIP_WRITE). */
  get canManageRanchRoles(): boolean {
    return this.isSaasOwner || this.sessionRoles.includes('administrator');
  }

  get companySelectOptions(): SearchableSelectOption[] {
    return this.companies.map((company) => ({
      value: company.uuid_company,
      label: company.name
    }));
  }

  get filteredUsers(): UserManagementItem[] {
    const query = this.userSearch.trim().toLowerCase();
    if (!query) {
      return this.users;
    }

    return this.users.filter((user) => {
      const companyName = this.companyNameForUser(user).toLowerCase();
      return (
        user.username?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.first_name?.toLowerCase().includes(query) ||
        user.last_name?.toLowerCase().includes(query) ||
        user.id_card?.toLowerCase().includes(query) ||
        companyName.includes(query)
      );
    });
  }

  get selectedCompanyName(): string {
    if (!this.selectedCompany?.trim()) {
      return '';
    }
    return this.companies.find((c) => c.uuid_company === this.selectedCompany)?.name ?? '';
  }

  companyNameForRanch(ranch: RanchOption): string {
    return this.companies.find((c) => c.uuid_company === ranch.uuid_company)?.name ?? ranch.uuid_company;
  }

  get selectedRanchName(): string {
    return this.ranches.find((r) => r.uuid_ranch === this.selectedRanch)?.name ?? '';
  }

  get userFormTenantCompanyDisplay(): string {
    if (this.isSaasOwner) {
      if (this.selectedCompany?.trim()) {
        return this.selectedCompanyName || this.i18nService.translate('users.tenantCompanyPlaceholder');
      }
      return this.i18nService.translate('users.allCompanies');
    }
    return this.i18nService.translate('users.tenantCompanyReadonly');
  }

  get userFormTenantContextVisible(): boolean {
    if (!this.editUser) {
      return false;
    }
    if (this.isSaasOwner) {
      return this.companies.length > 0;
    }
    return Boolean(this.sessionService.getSession()?.uuid_company);
  }

  companyNameForUser(user: UserManagementItem): string {
    return this.companies.find((c) => c.uuid_company === user.uuid_company)?.name ?? user.uuid_company;
  }

  ranchSelectLabel(ranch: RanchOption): string {
    if (this.isSaasOwner && !this.selectedCompany?.trim()) {
      return `${ranch.name} (${this.companyNameForRanch(ranch)})`;
    }
    return ranch.name;
  }

  get editFormCompanyNameHint(): string {
    if (!this.isSaasOwner) {
      return this.selectedCompanyName;
    }
    if (this.selectedCompany?.trim()) {
      return this.selectedCompanyName;
    }
    return this.editUser ? this.companyNameForUser(this.editUser) : '';
  }

  get createQueryParams(): Record<string, string> {
    const q: Record<string, string> = {};
    if (this.selectedCompany) {
      q['company'] = this.selectedCompany;
    }
    if (this.selectedRanch) {
      q['ranch'] = this.selectedRanch;
    }
    return q;
  }

  get availabilityCompanyId(): string | null {
    if (this.isSaasOwner) {
      const fromSelect = this.selectedCompany?.trim();
      if (fromSelect) {
        return fromSelect;
      }
      return this.editUser?.uuid_company ?? null;
    }
    return this.sessionService.getSession()?.uuid_company ?? null;
  }

  get availabilityExcludeUserId(): string | null {
    return this.editUser?.uuid_user ?? null;
  }

  openEdit(user: UserManagementItem): void {
    this.editUser = user;
    this.formValue = {
      id_card: user.id_card ?? '',
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      second_last_name: user.second_last_name ?? '',
      phone: user.phone ?? '',
      email: user.email ?? '',
      username: user.username ?? '',
      role: user.role ?? 'ranch_staff',
      password: ''
    };
  }

  saveUser(value: UserFormValue): void {
    if (!this.editUser) {
      return;
    }

    const payload: UserManagementPayload = {
      id_card: value.id_card,
      first_name: value.first_name,
      last_name: value.last_name,
      second_last_name: value.second_last_name?.trim() || null,
      phone: value.phone?.trim() || null,
      email: value.email,
      username: value.username,
      role: value.role
    };

    if (this.isSaasOwner) {
      const companyUuid = this.selectedCompany.trim() || this.editUser.uuid_company;
      if (companyUuid) {
        payload.uuid_company = companyUuid;
      }
    }
    if (this.isSaasOwner && value.password?.trim()) {
      payload.password = value.password;
    }

    this.userManagementService.updateUser(this.editUser.uuid_user, payload).subscribe({
      next: () => {
        this.errorMessage = '';
        this.editUser = null;
        this.formValue = this.buildEmptyForm();
        this.loadUsers();
      },
      error: (err: unknown) => {
        this.errorMessage = translateUserWriteError(this.i18nService, err, 'errors.saveUser');
      }
    });
  }

  canDeactivateUser(user: UserManagementItem): boolean {
    const selfUuid = this.sessionService.getUuidUser();
    return !selfUuid || selfUuid !== user.uuid_user;
  }

  deactivateUser(user: UserManagementItem): void {
    if (!this.canDeactivateUser(user)) {
      this.errorMessage = this.i18nService.translate('errors.cannotDeactivateSelf');
      return;
    }

    this.userManagementService.deactivateUser(user.uuid_user).subscribe({
      next: () => this.loadUsers(),
      error: (err: unknown) => {
        this.errorMessage = translateUserWriteError(this.i18nService, err, 'errors.deactivateUser');
      }
    });
  }

  cancelForm(): void {
    this.editUser = null;
    this.formValue = this.buildEmptyForm();
  }

  updateUserSearch(value: string): void {
    this.userSearch = value;
  }

  onCompanyChange(uuidCompany: string): void {
    this.selectedCompany = uuidCompany;
    this.userSearch = '';
    this.loadRanchAndUsers();
  }

  onRanchChange(uuidRanch: string): void {
    this.selectedRanch = uuidRanch;
    this.loadUsers();
  }

  private loadCompanies(): void {
    this.userManagementService.getCompanies().subscribe({
      next: (companies) => {
        this.companies = companies;
        const want = this.route.snapshot.queryParamMap.get('company') ?? '';
        this.selectedCompany =
          want && companies.some((c) => c.uuid_company === want) ? want : '';
        this.loadRanchAndUsers();
      },
      error: () => {
        this.errorMessage = this.i18nService.translate('errors.loadCompanies');
      }
    });
  }

  private loadUsers(): void {
    this.isLoading = true;
    this.userManagementService.getUsers(this.isSaasOwner ? (this.selectedCompany.trim() || undefined) : undefined).subscribe({
      next: (users) => {
        this.users = users;
        this.isLoading = false;
      },
      error: () => {
        this.users = [];
        this.errorMessage = this.i18nService.translate('errors.loadUsers');
        this.isLoading = false;
      }
    });
  }

  private buildEmptyForm(): UserFormValue {
    return {
      id_card: '',
      first_name: '',
      last_name: '',
      second_last_name: '',
      phone: '',
      email: '',
      username: '',
      role: 'ranch_staff',
      password: ''
    };
  }

  private loadRanchAndUsers(): void {
    const companyFilter = this.isSaasOwner ? (this.selectedCompany.trim() || undefined) : undefined;
    this.userManagementService.getRanches(companyFilter).subscribe({
      next: (ranches) => {
        this.ranches = ranches;
        const wantRanch = this.route.snapshot.queryParamMap.get('ranch') ?? '';
        this.selectedRanch =
          wantRanch && ranches.some((r) => r.uuid_ranch === wantRanch) ? wantRanch : ranches[0]?.uuid_ranch ?? '';
        this.loadUsers();
      },
      error: () => {
        this.ranches = [];
        this.selectedRanch = '';
        this.loadUsers();
      }
    });
  }
}
