import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SessionService } from '../../services/session.service';
import { hasPermission, Permission } from 'src/app/shared/constants/permissions';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {

  constructor(private readonly sessionService: SessionService) { }

  @Input() classApplied = false;
  @Output() sidebarLinkClicked = new EventEmitter<void>();

  /** SaaS owner: listado global de compañías. */
  get canAccessCompanies(): boolean {
    return this.hasPermission(Permission.COMPANY_READ);
  }

  /** Administrador u operador: detalle de su compañía (no listado global). */
  get canAccessTenantCompany(): boolean {
    return (
      !this.canAccessCompanies &&
      this.hasPermission(Permission.COMPANY_TENANT_READ) &&
      Boolean(this.sessionService.getUuidCompany())
    );
  }

  get tenantCompanyRouterLink(): string | null {
    return this.canAccessTenantCompany ? '/saas-management/my-company' : null;
  }

  get canAccessUsers(): boolean {
    return this.hasPermission(Permission.USER_READ);
  }

  get canAccessRanches(): boolean {
    return this.hasPermission(Permission.RANCH_READ);
  }

  get canAccessOwners(): boolean {
    return this.hasPermission(Permission.ANIMAL_READ);
  }

  get canAccessPaddocks(): boolean {
    return (
      this.hasPermission(Permission.PADDOCK_READ) ||
      this.hasPermission(Permission.RANCH_READ) ||
      this.hasPermission(Permission.ANIMAL_READ)
    );
  }

  get hasConfigurationSection(): boolean {
    return this.canAccessOwners || this.canAccessPaddocks;
  }

  get hasAdministrationSection(): boolean {
    return this.canAccessCompanies || this.canAccessUsers || this.canAccessTenantCompany || this.canAccessRanches;
  }

  private hasPermission(permission: Permission): boolean {
    const roles = this.sessionService.getRoles();
    return hasPermission(roles, permission);
  }

  closeSidebarOnMobile(): void {
    if (window.innerWidth < 992) {
      this.sidebarLinkClicked.emit();
    }
  }
}
