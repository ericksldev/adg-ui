import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, map, takeUntil } from 'rxjs/operators';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { RanchSummary } from 'src/app/features/companies/models/company-management.model';
import { MembershipItem, UserManagementItem } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import { RanchPageService } from '../../services/ranch-page.service';
import { normalizeUserRoles, UserRole } from 'src/app/shared/constants/domain.constants';
import { hasPermission, Permission } from 'src/app/shared/constants/permissions';

export interface RanchMemberRow {
  uuid_user: string;
  role: UserRole;
  username?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

@Component({
  selector: 'app-ranch-detail',
  templateUrl: './ranch-detail.component.html',
  styleUrls: ['./ranch-detail.component.scss']
})
export class RanchDetailComponent implements OnInit, OnDestroy {
  ranch: RanchSummary | null = null;
  companyName = '';
  members: RanchMemberRow[] = [];
  isLoading = true;
  errorMessage = '';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly ranchPageService: RanchPageService,
    private readonly userManagementService: UserManagementService,
    private readonly sessionService: SessionService,
    private readonly i18nService: I18nService
  ) {}

  get isSaasOwner(): boolean {
    return normalizeUserRoles(this.sessionService.getRoles() as string[]).includes('saas_owner');
  }

  get canReadUsers(): boolean {
    return hasPermission(normalizeUserRoles(this.sessionService.getRoles() as string[]), Permission.USER_READ);
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('uuidRanch');
      if (!id) {
        this.router.navigate(['/ranch-management']);
        return;
      }
      this.load(id);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  userManagementQueryParams(): Record<string, string> {
    if (!this.ranch) {
      return {};
    }
    if (this.isSaasOwner) {
      return { company: this.ranch.uuid_company, ranch: this.ranch.uuid_ranch };
    }
    return { ranch: this.ranch.uuid_ranch };
  }

  private load(uuidRanch: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.ranch = null;
    this.members = [];
    this.companyName = '';

    this.ranchPageService.getRanchById(uuidRanch).subscribe({
      next: (ranch) => {
        this.ranch = ranch;
        this.resolveCompanyName(ranch.uuid_company);
        this.loadMembers(uuidRanch, ranch.uuid_company);
      },
      error: () => {
        this.errorMessage = this.i18nService.translate('errors.loadRanches');
        this.isLoading = false;
      }
    });
  }

  private resolveCompanyName(uuidCompany: string): void {
    if (!this.isSaasOwner) {
      this.companyName = '';
      return;
    }
    this.userManagementService.getCompanies().subscribe({
      next: (list) => {
        this.companyName = list.find((c) => c.uuid_company === uuidCompany)?.name ?? '';
      },
      error: () => {
        this.companyName = '';
      }
    });
  }

  private loadMembers(uuidRanch: string, uuidCompany: string): void {
    const memberships$ = this.userManagementService.getMembershipsByRanch(uuidRanch).pipe(
      catchError(() => of([] as MembershipItem[]))
    );

    if (!this.canReadUsers) {
      memberships$.subscribe((memberships) => {
        this.members = this.mapMembershipRows(memberships, new Map());
        this.isLoading = false;
      });
      return;
    }

    forkJoin({
      memberships: memberships$,
      users: this.userManagementService
        .getUsers({
          page: 1,
          size: 500,
          status: 'all',
          uuid_company: this.isSaasOwner ? uuidCompany : undefined,
        })
        .pipe(
          map((result) => result.items),
          catchError(() => of([] as UserManagementItem[]))
        )
    }).subscribe({
      next: ({ memberships, users }) => {
        const userMap = new Map(users.map((u) => [u.uuid_user, u]));
        this.members = this.mapMembershipRows(memberships, userMap);
        this.isLoading = false;
      },
      error: () => {
        this.members = [];
        this.isLoading = false;
      }
    });
  }

  private mapMembershipRows(
    memberships: MembershipItem[],
    userMap: Map<string, UserManagementItem>
  ): RanchMemberRow[] {
    return memberships
      .filter((m) => m.is_active !== false)
      .map((m) => {
        const u = userMap.get(m.uuid_user);
        return {
          uuid_user: m.uuid_user,
          role: m.role,
          username: u?.username ?? null,
          email: u?.email ?? null,
          first_name: u?.first_name ?? null,
          last_name: u?.last_name ?? null
        };
      });
  }
}
