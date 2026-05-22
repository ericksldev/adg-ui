import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AutenticacionGuard } from 'src/app/core/guards/autentication.guard';
import { PermissionGuard } from 'src/app/core/guards/permission.guard';
import { Permission } from 'src/app/shared/constants/permissions';
import { RanchListComponent } from './pages/ranch-list/ranch-list.component';
import { RanchDetailComponent } from './pages/ranch-detail/ranch-detail.component';

const routes: Routes = [
  {
    path: '',
    component: RanchListComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: [Permission.RANCH_READ],
      breadcrumb: 'breadcrumbs.ranchManagement'
    }
  },
  {
    path: ':uuidRanch',
    component: RanchDetailComponent,
    canActivate: [AutenticacionGuard, PermissionGuard],
    data: {
      permissions: [Permission.RANCH_READ],
      breadcrumb: 'breadcrumbs.ranchDetail',
      hideBackButton: true
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RanchManagementRoutingModule {}
