import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { AutenticacionGuard } from 'src/app/core/guards/autentication.guard';
import { PermissionGuard } from 'src/app/core/guards/permission.guard';
import { Permission } from 'src/app/shared/constants/permissions';
import { SharedModule } from 'src/app/shared/shared.module';
import { CompanyActivationComponent } from './pages/company-activation/company-activation.component';
import { CompanyDetailComponent } from './pages/company-detail/company-detail.component';
import { CompanyTenantOverviewComponent } from './pages/company-tenant-overview/company-tenant-overview.component';
import { CompanyRanchCreateComponent } from './pages/company-ranch-create/company-ranch-create.component';
import { SaasManagementComponent } from './pages/saas-management/saas-management.component';
import { CompanyRanchListComponent } from './components/company-ranch-list/company-ranch-list.component';
import { CompanyUserListComponent } from './components/company-user-list/company-user-list.component';
import { CompanySubscriptionListComponent } from './components/company-subscription-list/company-subscription-list.component';

const routes: Routes = [
  {
    path: '',
    component: SaasManagementComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: [Permission.COMPANY_READ],
      breadcrumb: 'breadcrumbs.list'
    }
  },
  {
    path: 'my-company',
    component: CompanyTenantOverviewComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: [Permission.COMPANY_TENANT_READ],
      breadcrumb: 'breadcrumbs.myCompany'
    }
  },
  {
    path: ':uuidCompany/subscription',
    component: CompanyActivationComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: [Permission.COMPANY_WRITE],
      breadcrumb: 'breadcrumbs.subscription'
    }
  },
  {
    path: ':uuidCompany/ranches/new',
    component: CompanyRanchCreateComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: [Permission.RANCH_WRITE, Permission.COMPANY_TENANT_READ],
      breadcrumb: 'breadcrumbs.createRanch'
    }
  },
  {
    path: ':uuidCompany',
    component: CompanyDetailComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: [Permission.COMPANY_TENANT_READ],
      breadcrumb: 'breadcrumbs.detail'
    }
  }
];

@NgModule({
  declarations: [
    SaasManagementComponent,
    CompanyDetailComponent,
    CompanyTenantOverviewComponent,
    CompanyRanchCreateComponent,
    CompanyActivationComponent,
    CompanyRanchListComponent,
    CompanyUserListComponent,
    CompanySubscriptionListComponent
  ],
  imports: [CommonModule, FormsModule, NgbModule, RouterModule.forChild(routes), SharedModule]
})
export class CompanyModule {}
