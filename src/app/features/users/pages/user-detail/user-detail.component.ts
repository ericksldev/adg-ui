import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { I18nService } from 'src/app/core/services/i18n.service';
import { notAvailableLabel } from 'src/app/core/utils/i18n-display.util';
import { SessionService } from 'src/app/core/services/session.service';
import { RanchOption, UserManagementItem } from '../../models/user-management.model';
import { UserManagementService } from '../../services/user-management.service';
import { normalizeUserRole, normalizeUserRoles, UserRole } from 'src/app/shared/constants/domain.constants';
import { hasPermission, Permission } from 'src/app/shared/constants/permissions';

export interface UserDetailRanchRow {
  uuid_ranch: string;
  ranchName: string;
  role: UserRole | null;
}

@Component({
  selector: 'app-user-detail',
  templateUrl: './user-detail.component.html',
  styleUrls: ['./user-detail.component.scss']
})
export class UserDetailComponent implements OnInit {
  readonly normalizeUserRole = normalizeUserRole;

  user: UserManagementItem | null = null;
  companyName = '';
  /** Company-scoped role from the user record. */
  summaryRole: UserRole | null = null;
  ranchRows: UserDetailRanchRow[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly userManagementService: UserManagementService,
    private readonly sessionService: SessionService,
    private readonly i18nService: I18nService
  ) {}

  get isSaasOwner(): boolean {
    return normalizeUserRoles(this.sessionService.getRoles() as string[]).includes('saas_owner');
  }

  get canOpenRanchDetail(): boolean {
    return hasPermission(normalizeUserRoles(this.sessionService.getRoles() as string[]), Permission.RANCH_READ);
  }

  ngOnInit(): void {
    const uuidUser = this.route.snapshot.paramMap.get('uuidUser');
    if (!uuidUser) {
      this.errorMessage = this.i18nService.translate('errors.loadUsers');
      return;
    }
    this.loadUser(uuidUser);
  }

  private loadUser(uuidUser: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.user = null;
    this.summaryRole = null;
    this.ranchRows = [];

    this.userManagementService
      .getUserById(uuidUser)
      .pipe(
        catchError(() => of(null as UserManagementItem | null)),
        switchMap((user) => {
          if (!user) {
            return of({ user: null as UserManagementItem | null, ranches: [] as RanchOption[] });
          }
          return forkJoin({
            user: of(user),
            ranches: this.userManagementService
              .getRanches(this.isSaasOwner ? user.uuid_company : undefined)
              .pipe(catchError(() => of([] as RanchOption[])))
          });
        })
      )
      .subscribe({
        next: ({ user, ranches }) => {
          if (!user) {
            this.errorMessage = this.i18nService.translate('users.detailNotFound');
            this.companyName = notAvailableLabel(this.i18nService);
            this.isLoading = false;
            return;
          }
          this.user = user;
          this.companyName = user.company?.name ?? user.uuid_company ?? notAvailableLabel(this.i18nService);
          this.summaryRole = normalizeUserRole(String(user.role ?? ''));
          this.ranchRows = this.buildRanchRows(user.uuid_company, this.summaryRole, ranches);
          this.isLoading = false;
        },
        error: () => {
          this.errorMessage = this.i18nService.translate('errors.loadUsers');
          this.isLoading = false;
        }
      });
  }

  /** One row per company ranch; role is the same for every ranch (company-scoped permissions). */
  private buildRanchRows(
    uuidCompany: string,
    companyRole: UserRole | null,
    ranches: RanchOption[]
  ): UserDetailRanchRow[] {
    const list = ranches.filter((r) => r.uuid_company === uuidCompany);
    return list
      .map((r) => ({
        uuid_ranch: r.uuid_ranch,
        ranchName: r.name ?? r.uuid_ranch,
        role: companyRole
      }))
      .sort((a, b) => a.ranchName.localeCompare(b.ranchName, undefined, { sensitivity: 'base' }));
  }
}
